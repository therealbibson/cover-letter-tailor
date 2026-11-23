import { NextResponse } from "next/server";
import mammoth from "mammoth";
import fs from "node:fs";
import path from "node:path";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_CHARS = 12000;
const ALLOWED = new Set(["pdf", "docx", "txt", "md"]);

type ErrorCode =
  | "no_file"
  | "too_large"
  | "empty_file"
  | "unsupported_type"
  | "no_text"
  | "parse_failed"
  | "bad_request";

function fail(error: string, code: ErrorCode, status = 400) {
  return NextResponse.json({ error, code }, { status });
}

function extOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() as string) : "";
}

function cleanText(raw: string): string {
  // Collapse 3+ blank lines, trim, drop pdf-parse page markers, and cap
  // at the CV textarea limit.
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/^-- \d+ of \d+ --$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** First PDF parser: pdf-parse v2 (fast, handles most real-world PDFs). */
async function extractPdfWithPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

/**
 * Fallback PDF parser: pdfjs-dist (the engine behind pdf-parse).
 * Used when pdf-parse throws or returns no text — the two parsers fail on
 * different files, so a PDF one rejects the other can often still read.
 */
async function extractPdfWithPdfJs(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontsDir = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "standard_fonts",
  );
  const doc = await pdfjs
    .getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      // No worker is configured, so pdf.js runs on the main thread
      // (fake worker) — correct for a server route.
      // Silences "standardFontDataUrl" warnings and helps with non-standard
      // fonts when the package is present at runtime (it is, for external
      // server packages). Falls back gracefully if the dir is missing.
      standardFontDataUrl: fs.existsSync(standardFontsDir)
        ? standardFontsDir + path.sep
        : undefined,
    })
    .promise;
  try {
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
    }
    return text;
  } finally {
    await doc.destroy();
  }
}

async function extractPdf(buffer: Buffer): Promise<{ text: string }> {
  // Tracks whether at least one parser actually read the file. If a parser
  // runs cleanly but finds no text, the PDF is valid yet text-free (e.g.
  // scanned/image-only) — that is a different problem from a parse failure
  // and must surface as `no_text`, not `parse_failed`.
  let parsedOk = false;
  let lastError: unknown = null;
  try {
    const text = cleanText(await extractPdfWithPdfParse(buffer));
    parsedOk = true;
    if (text) return { text };
  } catch (err) {
    lastError = err;
  }
  // Fallback: pdfjs-dist often reads files pdf-parse rejects, and vice versa.
  try {
    const text = cleanText(await extractPdfWithPdfJs(buffer));
    parsedOk = true;
    if (text) return { text };
  } catch (err) {
    lastError = err;
  }
  if (parsedOk) return { text: "" };
  throw lastError ?? new Error("PDF parsing failed");
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return fail("No file was uploaded. Choose a PDF, DOCX, TXT or MD file.", "no_file");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(
      "We couldn't read that upload. Try again, or paste your CV instead.",
      "bad_request",
    );
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return fail("No file was uploaded. Choose a PDF, DOCX, TXT or MD file.", "no_file");
  }

  if (file.size > MAX_BYTES) {
    return fail("That file is too large — please upload a file under 5 MB.", "too_large");
  }
  if (file.size === 0) {
    return fail(
      "That file looks empty — try a different file, or paste your CV instead.",
      "empty_file",
    );
  }

  const ext = extOf(file.name);
  if (!ALLOWED.has(ext)) {
    return fail(
      `We can't read ".${ext || "?"}" files — upload a PDF, DOCX, TXT or MD file, or paste your CV instead.`,
      "unsupported_type",
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (ext === "txt" || ext === "md") {
      text = cleanText(buffer.toString("utf-8"));
    } else if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      text = cleanText(result.value);
    } else if (ext === "pdf") {
      const extracted = await extractPdf(buffer);
      text = extracted.text;
    }

    if (!text) {
      // The file parsed but has no selectable text: almost always a
      // scanned or image-only PDF (or a photo of a CV).
      return fail(
        "We couldn't find any selectable text in this file. It looks like a scanned or image-only PDF — try a text-based PDF or DOCX, or paste your CV instead.",
        "no_text",
      );
    }

    const truncated = text.length > MAX_CHARS;
    if (truncated) text = text.slice(0, MAX_CHARS);

    return NextResponse.json({
      text,
      filename: file.name,
      truncated,
    });
  } catch (err) {
    console.error("CV extraction failed:", err);
    return fail(
      "We couldn't read this file — it may be damaged, password-protected, or saved in an unusual format. Try re-saving it as a PDF or DOCX, or paste your CV instead.",
      "parse_failed",
    );
  }
}
