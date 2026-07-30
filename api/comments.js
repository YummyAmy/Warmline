// api/comments.js — collects the notes people leave in the comment box.
//
// IMPORTANT: submitted comments are saved to a PENDING list and are NOT shown
// on the site. Anything public strangers can type shouldn't go straight onto
// your homepage. You approve the ones you like, and only those get displayed.

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

const PENDING_KEY = "warmline:comments:pending";
const APPROVED_KEY = "warmline:comments:approved";

// Strip anything that looks like markup. The page also escapes on render,
// but defence in depth is cheap here.
function clean(s, max) {
  return String(s || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export default async function handler(req, res) {
  const cfg = redisConfig();

  // --- Read approved comments (public, safe) ---
  if (req.method === "GET") {
    const secret = process.env.ADMIN_SECRET;
    const given = req.query?.key || "";

    // With the admin key you see the pending queue instead.
    if (secret && given === secret) {
      if (!cfg) return res.status(200).json({ pending: [] });
      try {
        const raw = (await redis(cfg, ["LRANGE", PENDING_KEY, 0, 199])) || [];
        return res.status(200).json({ pending: raw.map((x) => JSON.parse(x)) });
      } catch {
        return res.status(500).json({ error: "Could not read queue" });
      }
    }

    if (!cfg) return res.status(200).json({ comments: [] });
    try {
      const raw = (await redis(cfg, ["LRANGE", APPROVED_KEY, 0, 49])) || [];
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return res.status(200).json({ comments: raw.map((x) => JSON.parse(x)) });
    } catch {
      return res.status(200).json({ comments: [] });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = clean(req.body?.name, 40) || "anon";
  const text = clean(req.body?.text, 280);

  if (!text) return res.status(400).json({ error: "Nothing to save" });

  if (!cfg) return res.status(200).json({ ok: true, storage: "not connected" });

  try {
    const entry = JSON.stringify({ name, text, at: new Date().toISOString() });
    await redis(cfg, ["LPUSH", PENDING_KEY, entry]);
    // Keep the queue from growing forever.
    await redis(cfg, ["LTRIM", PENDING_KEY, 0, 499]);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true, storage: "unavailable" });
  }
}

// ---------------------------------------------------------------------------
// TO SEE WHAT PEOPLE SUBMITTED:
//   https://your-site.vercel.app/api/comments?key=YOUR_ADMIN_SECRET
//
// TO PUBLISH ONE you like, run this once in the Upstash console (Data Browser),
// pasting the exact JSON line you want to show:
//   LPUSH warmline:comments:approved {"name":"Sarah","text":"..."}
// ---------------------------------------------------------------------------
