import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const bodySchema = z.object({
  jobDescription: z
    .string()
    .trim()
    .min(50, "Job description must be at least 50 characters.")
    .max(12000, "Job description must be 12,000 characters or fewer."),
  cv: z
    .string()
    .trim()
    .min(50, "Your CV/Resume must be at least 50 characters.")
    .max(12000, "Your CV/Resume must be 12,000 characters or fewer."),
  name: z.string().trim().max(120).optional().default(""),
  jobTitle: z.string().trim().max(200).optional().default(""),
  tone: z.enum(["Professional", "Friendly", "Confident"]).optional().default("Professional"),
});

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

async function generateWithModel(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request. Send a JSON body." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message =
      issue?.code === "invalid_type"
        ? "Job description and CV/Resume are both required."
        : (issue?.message ?? "Invalid input.");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { jobDescription, cv, name, jobTitle, tone } = parsed.data;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not configured. Add it to .env.local",
      },
      { status: 503 },
    );
  }

  const signOffName = name || "[Your Name]";
  const roleLine = jobTitle ? ` for the ${jobTitle} role` : " for this tech role";

  const prompt = [
    `Write a concise, tailored cover letter${roleLine}.`,
    `Tone: ${tone}. Length: 250-350 words, in 3-4 short paragraphs.`,
    "Rules:",
    "- Use only facts from the CV below. Do not invent employers, dates, skills, qualifications, or achievements.",
    "- Match keywords and requirements from the job description, using the candidate's real experience where it fits.",
    "- Do not add a subject line, headings, or placeholder text other than the sign-off name.",
    "- Keep it specific to this job, not generic.",
    `- Sign off with the name: ${signOffName}`,
    "",
    "--- JOB DESCRIPTION ---",
    jobDescription,
    "",
    "--- CV / EXPERIENCE ---",
    cv,
  ].join("\n");

  let lastError: unknown = null;
  for (const modelName of MODELS) {
    try {
      const letter = await generateWithModel(apiKey, modelName, prompt);
      return NextResponse.json({ letter });
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      // Only fall back to the second model for a model-not-found style error.
      const isModelError =
        /not found|404|model/i.test(message) && modelName === MODELS[0];
      if (!isModelError) break;
    }
  }

  console.error("Gemini generation failed:", lastError);
  return NextResponse.json(
    {
      error:
        "Could not generate a cover letter right now. Please try again in a moment.",
    },
    { status: 502 },
  );
}
