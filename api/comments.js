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

// Abuse guard. The LTRIM below already stops the queue growing without bound,
// but nothing stopped a script filling your review queue with 500 junk notes
// and burning Upstash commands doing it. Five notes a day per address is plenty.
const PER_IP_PER_DAY = 5;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.headers["x-real-ip"] || "unknown";
}

async function tooMany(cfg, req, tag) {
  if (!cfg) return false;
  try {
    const key = `warmline:rl:${today()}:${tag}:${clientIp(req)}`;
    const n = await redis(cfg, ["INCR", key]);
    if (n === 1) await redis(cfg, ["EXPIRE", key, 172800]);
    return n > PER_IP_PER_DAY;
  } catch {
    return false;
  }
}

// Strip anything that looks like markup. The page also escapes on render,
// but defence in depth is cheap here.
function clean(s, max) {
  return String(s || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function adminOk(req) {
  // Prefer a header. Query strings end up in browser history, proxy logs and
  // referrer headers; a header does not. ?key= still works so an existing
  // bookmark doesn't break, but the header is the one to use going forward:
  //   curl -H "x-admin-key: YOUR_SECRET" https://.../api/stats
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = String(req.headers["authorization"] || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const given = req.headers["x-admin-key"] || bearer || req.query?.key || "";
  return given === secret;
}

export default async function handler(req, res) {
  const cfg = redisConfig();

  // --- Read approved comments (public, safe) ---
  if (req.method === "GET") {
    // With the admin key you see the pending queue instead.
    if (adminOk(req)) {
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

  if (await tooMany(cfg, req, "cmt")) {
    // Look successful. The page has already optimistically shown their note,
    // and a bot gets no useful feedback either way.
    return res.status(200).json({ ok: true });
  }

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
