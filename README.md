# Cover Letter Tailor

Paste a job, paste your CV, get a tailored cover letter in 30 seconds.

Dead-simple v1 for tech job seekers, worldwide. No login, no signup, no database.

## What it does

- One page: job description + CV (+ optional name, job title/company, tone)
- Tone: Professional (default), Friendly, or Confident
- Generates a concise cover letter (250-350 words, 3-4 short paragraphs) using Google Gemini
- Uses only facts from the CV — it is prompted not to invent employers, dates, skills, or achievements
- Output: word count, Copy, Download .txt, Print / Save as PDF, Regenerate, Clear
- The last generated letter is saved in the browser (localStorage) so a refresh does not lose it

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Google Gemini (`@google/generative-ai`, model `gemini-2.5-flash`, with fallback to `gemini-2.0-flash`)
- Input validation with Zod
- Single repo, Vercel-ready. No separate backend, no auth, no database in v1.

## Run locally

```bash
npm install
cp .env.example .env.local
# Add your key to .env.local:
# GEMINI_API_KEY=your-key-here
# Get a free key from Google AI Studio: https://aistudio.google.com/app/apikey
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push this repo to GitHub (do not commit `.env.local` — it is gitignored).
2. Import it in Vercel.
3. Add the environment variable `GEMINI_API_KEY` in the Vercel project settings.
4. Deploy. No other configuration needed.

## API

`POST /api/generate`

Body (JSON):

```json
{
  "jobDescription": "... (50-12,000 chars, required)",
  "cv": "... (50-12,000 chars, required)",
  "name": "Usman Abeeb (optional)",
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
- ATS score, multiple templates, or CV upload (paste text only)
- Separate Express backend

Add those only if v1 gets real use.
