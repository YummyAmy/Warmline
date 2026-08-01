// api/research.js — V2, PAID TIER ONLY. Not wired into the site yet.
//
// Given a company name, does ONE web search and returns the single most recent
// concrete fact about them, so write.js can work it into the opener. This is
// the feature people pay for: the opener references something real and current
// that the user never had to type.
//
// WHY IT IS GATED: a search plus a longer prompt roughly triples the cost per
// opener. On the free tier that empties the $5 balance in an afternoon. So this
// only runs for a paid, verified email. write.js must confirm paid status
// BEFORE calling this.
//
// STATUS: scaffold. It will not run until:
//   1. A search provider key is added to Vercel (e.g. BRAVE_SEARCH_KEY, or swap
//      in whichever provider you choose).
//   2. write.js is updated to call it for paid users.
// Nothing here touches the live free tool.

function searchConfig() {
  // Swap this for whatever search API you pick. Brave and Serper both have
  // cheap/free tiers and a simple JSON response.
  const key = process.env.BRAVE_SEARCH_KEY || process.env.SERPER_KEY;
  return key || null;
}

// Returns a short factual string, or null if nothing solid was found.
// Deliberately returns null rather than guessing — a made-up "fact" in a cold
// opener is worse than no fact at all.
export async function researchCompany(company) {
  const name = String(company || "").trim().slice(0, 120);
  if (!name) return null;

  const key = searchConfig();
  if (!key) return null; // not configured yet — caller falls back to no-research

  try {
    // Example shape for Brave. Adjust to your chosen provider.
    const r = await fetch(
      "https://api.search.brave.com/res/v1/web/search?q=" +
        encodeURIComponent(`${name} news`),
      { headers: { "X-Subscription-Token": key, Accept: "application/json" } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const first = data?.web?.results?.[0];
    if (!first) return null;

    // Hand back a compact fact for the prompt: title + description, trimmed.
    const fact = [first.title, first.description]
      .filter(Boolean)
      .join(" — ")
      .replace(/\s+/g, " ")
      .slice(0, 240);
    return fact || null;
  } catch {
    return null; // never let a research hiccup break the opener
  }
}

// Optional HTTP handler, so this can be tested on its own once a key exists.
// Guarded so it can't be abused as a free search proxy: it should only ever be
// reachable behind the paid check in write.js in production.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!searchConfig()) return res.status(200).json({ fact: null, status: "not configured" });
  const { company = "" } = req.body || {};
  const fact = await researchCompany(company);
  return res.status(200).json({ fact });
}
