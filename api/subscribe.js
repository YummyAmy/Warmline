// api/subscribe.js — saves emails from the "get the next tool in your inbox" box.
// Stored in a Redis hash: one entry per email, so the same person signing up
// twice doesn't create a duplicate. Value is the date they signed up.

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

const LIST_KEY = "warmline:subscribers";

// Abuse guard. This endpoint had none, so a script could hammer it all day:
// junk in the list, and every hit burns an Upstash command, which IS billable
// on pay-as-you-go. Ten a day per address is far more than a real person needs.
const PER_IP_PER_DAY = 10;

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
    return false; // a Redis hiccup shouldn't block a real signup
  }
}

// Deliberately simple. Real validation is whether the email bounces, not regex.
function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
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
  // GET with the right secret = download your list. See notes at the bottom.
  if (req.method === "GET") {
    if (!adminOk(req)) {
      return res.status(404).json({ error: "Not found" });
    }
    const cfg = redisConfig();
    if (!cfg) return res.status(200).json({ subscribers: [], count: 0 });
    try {
      const flat = (await redis(cfg, ["HGETALL", LIST_KEY])) || [];
      // HGETALL comes back as [email, date, email, date, ...]
      const subscribers = [];
      for (let i = 0; i < flat.length; i += 2) {
        subscribers.push({ email: flat[i], signedUp: flat[i + 1] });
      }
      return res.status(200).json({ subscribers, count: subscribers.length });
    } catch {
      return res.status(500).json({ error: "Could not read list" });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email = "", source = "" } = req.body || {};
  const clean = String(email).trim().toLowerCase().slice(0, 254);

  // Where the signup came from, so the export tells you WHY someone joined.
  // "waitlist" means they burned all 15 lines and asked for v2.0, which is the
  // most valuable signal on the whole site. Anything else is the newsletter box.
  const from = String(source).trim().slice(0, 20).replace(/[^a-z-]/gi, "");

  if (!looksLikeEmail(clean)) {
    return res.status(400).json({ error: "That doesn't look like an email" });
  }

  const cfg = redisConfig();
  // Storage is not wired up, so the address would be lost. Fail loudly: this
  // used to return 200 and the page thanked people for a signup that never
  // happened. An unhappy visitor who can retry beats a lost subscriber.
  if (!cfg) {
    return res.status(503).json({ error: "Storage unavailable, please try again shortly" });
  }

  if (await tooMany(cfg, req, "sub")) {
    // Say OK rather than showing an error. A real person who double-clicked
    // shouldn't see a failure, and a bot doesn't deserve a useful signal.
    return res.status(200).json({ ok: true });
  }

  try {
    // HSET only overwrites the signup date if they're already on the list.
    const stamp = new Date().toISOString();
    await redis(cfg, ["HSET", LIST_KEY, clean, from ? `${stamp} (${from})` : stamp]);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(503).json({ error: "Storage unavailable, please try again shortly" });
  }
}

// ---------------------------------------------------------------------------
// TO READ YOUR LIST:
//   1. In Vercel, add an environment variable ADMIN_SECRET set to any long
//      random string you invent (treat it like a password).
//   2. curl -H "x-admin-key: YOUR_SECRET" https://your-site/api/subscribe
//   Without the correct key this returns a 404, so nobody can scrape your list.
// ---------------------------------------------------------------------------
