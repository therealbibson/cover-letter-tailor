import { NextResponse } from "next/server";
import mammoth from "mammoth";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_CHARS = 12000;
const ALLOWED = new Set(["pdf", "docx", "txt", "md"]);

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

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read that file — try a PDF, DOCX or TXT file, or paste your CV instead." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file was uploaded. Choose a PDF, DOCX, TXT or MD file." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is too large — please upload a file under 5 MB." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { error: "That file looks empty — try a different file, or paste your CV instead." },
      { status: 400 },
    );
  }

  const ext = extOf(file.name);
  if (!ALLOWED.has(ext)) {
    return NextResponse.json(
      { error: "Could not read that file — try a PDF, DOCX or TXT file, or paste your CV instead." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (ext === "txt" || ext === "md") {
      text = buffer.toString("utf-8");
    } else if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === "pdf") {
      // pdf-parse v2: dynamic import keeps it out of the client bundle.
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
    }

    text = cleanText(text);
    if (!text) {
      return NextResponse.json(
        { error: "Could not read any text from that file — try a PDF, DOCX or TXT file, or paste your CV instead." },
        { status: 400 },
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
    return NextResponse.json(
      { error: "Could not read that file — try a PDF, DOCX or TXT file, or paste your CV instead." },
      { status: 400 },
    );
  }
}
