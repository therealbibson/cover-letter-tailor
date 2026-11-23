"use client";

import { useEffect, useState } from "react";

type Tone = "Professional" | "Friendly" | "Confident";

const TONES: Tone[] = ["Professional", "Friendly", "Confident"];
const STORAGE_KEY = "cover-letter-tailor:last";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-800";

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [cv, setCv] = useState("");
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [tone, setTone] = useState<Tone>("Professional");
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Restore the last generated letter so a refresh does not lose it.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLetter(saved);
    } catch {
      // localStorage unavailable — ignore.
    }
  }, []);

  useEffect(() => {
    try {
      if (letter) localStorage.setItem(STORAGE_KEY, letter);
    } catch {
      // localStorage unavailable — ignore.
    }
  }, [letter]);

  const wordCount = letter ? letter.trim().split(/\s+/).length : 0;

  async function handleGenerate() {
    setError("");
    setCopied(false);

    if (jobDescription.trim().length < 50) {
      setError("Job description must be at least 50 characters. Paste the full job post if you can.");
      return;
    }
    if (cv.trim().length < 50) {
      setError("Your CV must be at least 50 characters. Add your experience, skills, and projects.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, cv, name, jobTitle, tone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Something went wrong. Please try again.",
        );
        return;
      }
      if (typeof data?.letter !== "string" || !data.letter.trim()) {
        setError("The generator returned an empty letter. Please try again.");
        return;
      }
      setLetter(data.letter.trim());
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the text and copy it manually.");
    }
  }

  function handleDownload() {
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    setJobDescription("");
    setCv("");
    setName("");
    setJobTitle("");
    setTone("Professional");
    setLetter("");
    setError("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Cover Letter Tailor
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Paste a job, paste your CV, get a tailored cover letter in 30 seconds.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={labelClass}>
              Your name <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Usman Abeeb"
              maxLength={120}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="jobTitle" className={labelClass}>
              Job title / company <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="jobTitle"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Frontend Developer at Acme"
              maxLength={200}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="job" className={labelClass}>
            Job description <span className="text-red-600">*</span>
          </label>
          <textarea
            id="job"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here…"
            rows={7}
            maxLength={12000}
            className={inputClass}
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {jobDescription.length.toLocaleString()} / 12,000
          </p>
        </div>

        <div className="mt-2">
          <label htmlFor="cv" className={labelClass}>
            Your CV / experience <span className="text-red-600">*</span>
          </label>
          <textarea
            id="cv"
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            placeholder="Paste your CV, experience, skills, and projects here…"
            rows={7}
            maxLength={12000}
            className={inputClass}
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {cv.length.toLocaleString()} / 12,000
          </p>
        </div>

        <div className="mt-4">
          <span className={labelClass}>Tone</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tone">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                aria-pressed={tone === t}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  tone === t
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-teal-700 hover:text-teal-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-teal-700 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Tailoring your letter…" : "Generate cover letter"}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          No login. No signup. Your inputs are only used to generate this letter.
        </p>
      </section>

      {letter && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Your cover letter</h2>
            <span className="text-sm text-slate-500">{wordCount} words</span>
          </div>

          <div
            id="print-letter"
            className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800"
          >
            {letter}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-700 hover:text-teal-700"
            >
              Download .txt
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-700 hover:text-teal-700"
            >
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-700 hover:text-teal-700 disabled:opacity-60"
            >
              {loading ? "Regenerating…" : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:text-red-600"
            >
              Clear
            </button>
          </div>
        </section>
      )}

      <footer className="mt-8 text-center text-xs text-slate-400">
        Built for tech job seekers. Check every fact before you send it.
      </footer>
    </main>
  );
}
