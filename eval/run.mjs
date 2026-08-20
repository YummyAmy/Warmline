// eval/run.mjs — the fixed test set for Warmline's output quality.
//
// WHAT THIS IS FOR
// Every time the prompt changes, the honest question is "did that make the
// output better or worse?" Testing three prospects by hand cannot answer it,
// because you remember the good ones. This runs the SAME thirteen prospects
// every time and writes the results to a file, so two versions can be compared
// side by side instead of from memory.
//
// This is model evaluation, not web development. It is the part a data analyst
// is already qualified to do.
//
// RUN IT AGAINST THE LIVE SITE
//   node eval/run.mjs
//
// OR AGAINST A VERCEL PREVIEW BRANCH
//   node eval/run.mjs https://warmline-git-quality-yourname.vercel.app
//
// Results go to eval/results-YYYY-MM-DD.json, and a summary prints in the
// terminal. Read every line yourself: the machine can only catch banned words
// and shapes, it cannot tell you whether you would actually send it.
//
// NOTE: this uses your own daily IP limit, 25 requests. Thirteen prospects
// leaves room for one repair each. Do not run it twice in a day.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = process.argv[2] || "https://warmline.dataaccordingtome.com";
const prospects = JSON.parse(readFileSync(new URL("./prospects.json", import.meta.url)));

// Same checks the server runs, so the eval agrees with production.
const BAD = [
  "usually","typically","generally","obviously","clearly","certainly","definitely",
  "simply","basically","essentially","literally","really","exact","exactly",
  "precisely","seamless","leverage","synergy","scalable",
];
const SHAPES = [
  /here'?s the truth/i, /what matters is/i, /matters? (?:less|more) than/i,
  /the kind of thing that/i, /most (?:people|teams|companies)/i,
  /chewing on it/i, /i'?ve been following/i, /i read (?:a few|several)/i,
  /it'?s not \w+,? it'?s/i, /at the end of the day/i,
];

const flags = (line) => [
  ...BAD.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(line)).map((w) => `word:${w}`),
  ...SHAPES.filter((r) => r.test(line)).map((r) => `shape:${r.source.slice(0, 26)}`),
];

const results = [];
for (const p of prospects) {
  process.stdout.write(`  ${p.id.padEnd(18)} `);
  try {
    const r = await fetch(`${BASE}/api/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        row: { name: p.name, company: p.company, detail: p.detail },
        toneKey: p.tone,
        offer: p.offer,
      }),
    });
    const body = await r.json().catch(() => ({}));

    if (r.status === 422) {
      console.log("REFUSED (too thin) — correct if that was expected");
      results.push({ ...p, status: 422, line: null, flags: [], refused: true });
      continue;
    }
    if (!r.ok) {
      console.log(`HTTP ${r.status} ${body.error || ""}`);
      results.push({ ...p, status: r.status, line: null, error: body.error });
      continue;
    }

    const line = body.line || "";
    const f = flags(line);
    const words = line.trim().split(/\s+/).length;
    const sentences = (line.match(/[.!?](?:\s|$)/g) || []).length;
    console.log(`${f.length ? "FLAGS " + f.join(",") : "clean"}  (${sentences}s ${words}w)`);
    results.push({ ...p, status: 200, line, flags: f, words, sentences });
  } catch (e) {
    console.log("failed:", e.message);
    results.push({ ...p, error: String(e) });
  }
}

const day = new Date().toISOString().slice(0, 10);
mkdirSync(new URL("./", import.meta.url), { recursive: true });
const out = new URL(`./results-${day}.json`, import.meta.url);
writeFileSync(out, JSON.stringify(results, null, 2));

const ok = results.filter((r) => r.status === 200);
const clean = ok.filter((r) => !r.flags.length);
console.log(`\n  ${clean.length}/${ok.length} passed the automatic checks`);
console.log(`  saved to eval/results-${day}.json`);
console.log(`
  NOW DO THE PART THE MACHINE CANNOT. Open that file and score each line:
    grounded  — every claim traceable to the detail or the outreach reason
    natural   — would you send it unchanged
    specific  — uses the detail rather than gesturing at it
    useful    — gives them a reason to reply

  Your release rule: no invented claims, and at least 8 of 13 sendable
  with no edit. If a version fails that, do not ship it.
`);
