// api/write.js — runs on Vercel. Your API key lives in an environment
// variable here, NEVER in the webpage, so visitors can't see or steal it.

function redisConfig() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redis(cfg, command) {
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`Redis said ${r.status}`);
  const data = await r.json();
  return data.result;
}

// --- Spend guards -----------------------------------------------------------
// The 15-use limit in the browser is a courtesy, not a lock — anyone can clear
// their storage. These two limits run on the server, where they can't be
// bypassed, and they're what actually protects your API bill.
const PER_IP_PER_DAY = 40;    // generous for a real person, useless for a script
const GLOBAL_PER_DAY = 1500;  // hard ceiling across everyone

function today() {
  return new Date().toISOString().slice(0, 10); // "2026-07-30"
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.headers["x-real-ip"] || "unknown";
}

// Returns a refusal reason, or null if the request is allowed through.
async function checkLimits(cfg, ip) {
  if (!cfg) return null; // storage not connected — fail open, cap is the backstop

  const day = today();
  const ipKey = `warmline:rl:${day}:${ip}`;
  const globalKey = `warmline:rl:${day}:all`;

  try {
    const ipCount = await redis(cfg, ["INCR", ipKey]);
    if (ipCount === 1) await redis(cfg, ["EXPIRE", ipKey, 172800]); // clean up after 2 days
    if (ipCount > PER_IP_PER_DAY) return "ip";

    const allCount = await redis(cfg, ["INCR", globalKey]);
    if (allCount === 1) await redis(cfg, ["EXPIRE", globalKey, 172800]);
    if (allCount > GLOBAL_PER_DAY) return "global";
  } catch {
    return null; // Redis hiccup shouldn't take the tool down
  }
  return null;
}
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Writer not configured" });
  }

  const { row = {}, tone = "", offer = "", banned = [] } = req.body || {};

  // Cap input lengths so nobody can paste a novel and run up your token bill.
  const name = String(row.name || "").trim().slice(0, 80);
  const company = String(row.company || "").trim().slice(0, 120);
  const detail = String(row.detail || "").trim().slice(0, 600);
  const offerText = String(offer || "").trim().slice(0, 400);
  const toneText = String(tone || "").slice(0, 800);

  if (!name && !company && !detail) return res.status(400).json({ error: "Nothing to work with" });

  const cfg = redisConfig();
  const blocked = await checkLimits(cfg, clientIp(req));
  if (blocked === "ip") {
    return res.status(429).json({ error: "You've hit today's limit. Try again tomorrow." });
  }
  if (blocked === "global") {
    return res.status(429).json({ error: "Warmline is resting — it hit today's ceiling. Back tomorrow." });
  }

  const banList = Array.isArray(banned) && banned.length
    ? banned.slice(0, 80).join(", ")
    : "really, actually, leverage, seamless, scalable";

  const prompt = `You write the FIRST LINE of a cold outreach message — the opener that proves it isn't spam. Not the whole message. Just one or two sentences that show real attention to this specific person.

Prospect:
- Name: ${name || "(unknown)"}
- Company/newsletter: ${company || "(unknown)"}
- Detail I know about them: ${detail || "(none given)"}

${offerText ? `What I'm reaching out about: ${offerText}` : ""}

Tone: ${toneText}.

This must read like one human talking to another human. Picture it: you just ran into this person at a park on a hot Thursday and you've got 20 seconds to say something real before the moment passes. Slightly caught off guard, completely genuine, zero rehearsed-pitch energy.

Voice rules:
- Write like you're texting a smart friend about something they made. Casual, direct, real.
- Conversational looseness is GOOD. A slightly rambly sentence, an em-dash where a period "should" go, starting with "so" or "honestly" — these read as human. Polished-perfect reads as AI. Don't over-smooth it.
- Contractions always. Plain everyday words over fancy ones — "got" not "obtained," "so" not "therefore."

Hard rules:
- Open with THEM, not me. Reference the detail naturally, like it genuinely stuck with you.
- Sound like a specific human wrote it in 20 seconds because they actually noticed something — never like a template.
- NEVER use these words or phrases (tell-tale AI/spam signs): ${banList}.
- NEVER use "it's not X, it's Y" or "not just X, but Y" or "isn't about X, it's about Y" contrast constructions. Say the point straight.
- NEVER use rule-of-three lists (e.g. "simple, fast, and human"). Pick one word, or write a real sentence.
- No "I hope this email finds you well." No "I came across your profile." No "just wanted to reach out." No flattery clichés.
- Don't announce what you're doing ("I noticed," "I saw") more than once, if at all — just say the thing.
- One vivid specific detail beats three vague compliments.
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

    if (!r.ok) {
      // Log the real reason to Vercel's function logs so you can debug,
      // without leaking anything to the visitor.
      let why = "";
      try { why = await r.text(); } catch {}
      console.error("Anthropic error", r.status, why.slice(0, 500));
      return res.status(502).json({ error: "Writer unavailable" });
    }

    const data = await r.json();
    const line = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");

    // Count it. Done inline, so there's no second network hop and no COUNT_URL
    // environment variable to configure or get wrong.
    if (cfg) {
      try { await redis(cfg, ["INCR", "warmline:openers"]); } catch {}
    }

    return res.status(200).json({ line });
  } catch (e) {
    console.error("write.js failed", e);
    return res.status(500).json({ error: "Something broke" });
  }
}
