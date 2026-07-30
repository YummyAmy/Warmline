// api/write.js — runs on Vercel. Your API key lives in an environment
// variable here, NEVER in the webpage, so visitors can't see or steal it.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { row = {}, tone = "", offer = "", banned = [] } = req.body || {};
  const name = (row.name || "").trim();
  const company = (row.company || "").trim();
  const detail = (row.detail || "").trim();
  if (!name && !company && !detail) return res.status(400).json({ error: "Nothing to work with" });

  const banList = banned.length ? banned.join(", ") : "really, actually, leverage, seamless, scalable";

  const prompt = `You write the FIRST LINE of a cold outreach message — the opener that proves it isn't spam. Not the whole message. Just one or two sentences that show real attention to this specific person.

Prospect:
- Name: ${name || "(unknown)"}
- Company/newsletter: ${company || "(unknown)"}
- Detail I know about them: ${detail || "(none given)"}

${offer ? `What I'm reaching out about: ${offer}` : ""}

Tone: ${tone}.

Hard rules:
- Open with THEM, not me. Reference the detail naturally.
- Sound like a specific human wrote it in 20 seconds because they actually noticed something.
- NEVER use these words or phrases (they are the tell-tale signs of AI/spam writing): ${banList}.
- No "I hope this email finds you well." No "I came across your profile." No flattery clichés.
- Contractions are good. Plain words are good. One vivid specific detail beats three vague compliments.
- 1-2 sentences MAX. Return ONLY the line — no quotes, no preamble, no sign-off.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "Writer unavailable" });
    const data = await r.json();
    const line = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim().replace(/^["']|["']$/g, "");
    try { const base = process.env.COUNT_URL; if (base) await fetch(base + "/incr", { method: "POST" }); } catch {}
    return res.status(200).json({ line });
  } catch {
    return res.status(500).json({ error: "Something broke" });
  }
}
