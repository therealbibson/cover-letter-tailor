# Cover Letter Tailor

Upload your CV, paste a job, get a tailored cover letter in 30 seconds.

Dead-simple v1 for tech job seekers, worldwide. No login, no signup, no database.

## What it does

- One page: upload your CV/Resume (PDF, DOCX, TXT or MD, max 5 MB) or paste it, plus the job description (+ optional name, job title/company, tone)
- Tone: Professional (default), Friendly, or Confident
- Generates a concise cover letter (250-350 words, 3-4 short paragraphs) using Google Gemini
- Uses only facts from the CV — it is prompted not to invent employers, dates, skills, or achievements
- Output: word count, Copy, Download .txt, Print / Save as PDF, Regenerate, Clear
- The last generated letter is saved in the browser (localStorage) so a refresh does not lose it

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Google Gemini (`@google/generative-ai`, model `gemini-2.5-flash`, with fallback to `gemini-2.0-flash`)
- CV upload extraction via `POST /api/extract-cv`: PDF with `pdf-parse`, DOCX with `mammoth`, TXT/MD as plain text
- Input validation with Zod
- Single repo, Vercel-ready. No separate backend, no auth, no database in v1.

## Run locally

```bash
npm install
# Create .env.local and add your key to it:
# GEMINI_API_KEY=your-key-here
# Get a free key from Google AI Studio: https://aistudio.google.com/app/apikey
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push this repo to GitHub (do not commit `.env.local` or `.env.example` — both are gitignored).
2. Import it in Vercel.
3. Add the environment variable `GEMINI_API_KEY` in the Vercel project settings.
4. Deploy. No other configuration needed.

## API

`POST /api/extract-cv`

Multipart form upload with a `file` field (PDF, DOCX, TXT or MD, max 5 MB).

Success: `200 { "text": "...", "filename": "...", "truncated": false }`

Errors (JSON `{ "error": "...", "code": "..." }`):
- `400` `no_file` — no file was uploaded
- `400` `unsupported_type` — not a PDF, DOCX, TXT or MD file
- `400` `too_large` — file over 5 MB
- `400` `empty_file` — file is empty
- `400` `no_text` — the file parsed but has no selectable text (e.g. a scanned or image-only PDF)
- `400` `parse_failed` — the file could not be parsed (damaged, password-protected, or an unusual format)

PDFs are read with pdf-parse first, with pdfjs-dist as a fallback — the two parsers fail on different files, so a PDF one rejects the other can often still read.

`POST /api/generate`

Body (JSON):

```json
{
  "jobDescription": "... (50-12,000 chars, required)",
  "cv": "... (50-12,000 chars, required)",
  "name": "John Doe (optional)",
  "jobTitle": "Frontend Developer at Acme (optional)",
  "tone": "Professional | Friendly | Confident (optional, default Professional)"
}
```

Success: `200 { "letter": "..." }`

Errors (JSON `{ "error": "..." }`, no stack traces or keys):
- `400` — invalid / too-short / too-long input
- `503` — `GEMINI_API_KEY` is not configured
- `502` — Gemini failed to generate a letter

## Deliberately left out of v1

- Login / signup, accounts, saved history on a server
- Database
- Payments / paywall
- ATS score, multiple templates, or CV upload for other formats
- Separate Express backend

Add those only if v1 gets real use.
