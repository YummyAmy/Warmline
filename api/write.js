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
- Write the way you'd text a smart friend about something they made. Plain words, real sentences, contractions always.
- Every sentence gets a subject. "I saw the error on your dashboard," never "Saw the error on your dashboard." Dropping the "I" reads like a telegram, not a person.
- Use ordinary verbs for noticing. "I saw," "I read," "I noticed." NOT "I caught," "I spotted," "I clocked," "I came across." The fancy verb is you performing attentiveness instead of paying it.
- Hedge like a person who is guessing, because you are. You have one detail and nothing else. "I think it's," "looks like," "my guess is," "might be." A real person who half-knows something says so.
- One sentence is usually enough. Add a second only if it says something the first didn't.
- Stop when the point lands. Don't tack on another clause with "and" to soften the ending.
- Say full words. "Congratulations," not "congrats." "Probably," not "prob."

PUNCTUATION — this one is not negotiable:
- Use NO em-dashes and NO en-dashes. Not one, anywhere in the line. Use a period or a comma instead.
  An em-dash in a cold opener is the single loudest machine tell there is. If you find yourself
  reaching for one, end the sentence and start a new one, or just use a comma.

Never do these. They are the tells:
- No comparative flattery you can't back up: "better than most," "tighter than most I see," "one of the few people who," "rare to see." You haven't seen the others and they know it.
- No "more than I expected," "longer than I meant to," "than I'd like to admit." Formula.
- No clichés of recognition: "hit close to home," "resonated," "struck a chord," "spot on," "nailed it," "food for thought," "made me think."
- NEVER the words "exact," "exactly," or "precisely." Not once. They are a cheap way to fake specificity without supplying any. If you actually know the thing, name the thing. If you don't, say you're guessing.
- No claiming certainty you cannot have. "I know exactly what's causing it," "I know why that's happening," "I can tell you what's wrong." You read one sentence about this person. You don't know. Certainty from a stranger reads as either a con or a bot.
- No establishing your own credentials: "from my own work building X," "I've dealt with this myself," "in my experience," "I've seen this before." That turns their thing into a springboard for your resume. The opener is about them.
- No offering to collaborate, meet, hop on a call, or "write it up together" unless the outreach reason above explicitly says so. Proposing to co-create with a stranger is presumptuous and instantly reads as a pitch.
- No consultant vocabulary: "navigating," "structural," "failure modes," "unpack," "surface" as a verb, "landscape," "space," "ecosystem," "journey."
- NEVER these words or phrases: ${banList}.
- No "it's not X, it's Y" or "not just X, but Y" or "isn't about X, it's about Y." Say the point straight.
- No rule-of-three lists ("simple, fast, and human"). Pick one word, or write a real sentence.
- No "I hope this email finds you well." No "I came across your profile." No "just wanted to reach out."

Shape:
- Open with THEM. Reference the detail like it actually stuck with you.
- Vary how you start. Don't default to "Your [thing]..." every time.
- One vivid specific beats three vague compliments.
- If you're guessing about them, don't. Only say what the detail actually supports.
- If a reason for reaching out was given above, you may close with ONE small concrete offer. Size it, and make it easy to say no to. "We could look at it for twenty minutes if you want" sounds like a person being useful. "I'd love to hop on a call" sounds like step four of a sales sequence. If no reason was given, offer nothing and just say the observation.

The difference, in one pair. Same information, two very different people:

  MACHINE: "I caught the error on your dashboard and I know exactly what's causing it."
  HUMAN:   "I saw the bug on your dashboard and I think it's the date filter. We could look at it for twenty minutes if you want."

The second one wins on four counts: an ordinary verb (saw, not caught), an honest hedge (I think, not I know), it names the actual suspected thing instead of hiding behind "exactly," and it ends with something small that is easy to refuse. Copy that posture, not those words.

Return ONLY the line. No quotes, no preamble, no sign-off.`;

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
    let line = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");

    // Belt and braces on the dash rule. The prompt forbids em/en dashes, but a
    // model can still slip, and one dash undoes the whole "a human wrote this"
    // effect. So we also strip them mechanically, which cannot slip.
    line = line
      // " word — word "  ->  " word, word "
      .replace(/\s*[—–]\s*/g, ", ")
      // don't leave ",," or ", ," behind
      .replace(/,\s*,/g, ",")
      // a comma right before end punctuation is never right
      .replace(/,\s*([.!?])/g, "$1")
      // collapse any double spaces the swap introduced
      .replace(/\s{2,}/g, " ")
      .trim();

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
