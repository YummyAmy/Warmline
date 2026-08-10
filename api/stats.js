// api/stats.js — the numbers that tell you whether Warmline is working.
//
// No cookies, no third-party script, nothing that follows anyone between sites.
// Each event is one integer in Redis. That is the whole system.
//
// TO SEE YOUR NUMBERS:
//   https://warmline.dataaccordingtome.com/api/stats?key=YOUR_ADMIN_SECRET
// (ADMIN_SECRET is the same environment variable the subscriber list uses.)
// Without the key this returns 404, so nobody else can read them.

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

// Only these names are ever written. An open counter that accepts any string is
// an invitation to fill your database with junk keys.
const EVENTS = [
  "visit",     // someone loaded the page
  "example",   // someone pressed "Show me an example"
  "share",     // someone shared a line
  "generated", // a line was successfully written (incremented by write.js)
  "tone:warm",
  "tone:direct",
  "tone:technical",
  "tone:executive",
];

const KEY = (e) => `warmline:stats:${e}`;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.headers["x-real-ip"] || "unknown";
}

// Nobody needs to log 500 page views a day from one address. This stops a
// script inflating the numbers and burning through the Upstash quota.
const PER_IP_PER_DAY = 60;

export default async function handler(req, res) {
  const cfg = redisConfig();

  if (req.method === "GET") {
    const secret = process.env.ADMIN_SECRET;
    const given = req.query?.key || "";
    if (!secret || given !== secret) {
      return res.status(404).json({ error: "Not found" });
    }
    if (!cfg) return res.status(200).json({ stats: {}, storage: "not connected" });
    try {
      const vals = await redis(cfg, ["MGET", ...EVENTS.map(KEY)]);
      const stats = {};
      EVENTS.forEach((e, i) => {
        stats[e] = parseInt((vals && vals[i]) || "0", 10) || 0;
      });

      // The two numbers worth looking at first.
      const visits = stats.visit || 0;
      const generated = stats.generated || 0;
      stats._conversion =
        visits > 0 ? `${((generated / visits) * 100).toFixed(1)}% of visits produce a line` : "no visits yet";
      stats._sharePerLine =
        generated > 0 ? `${(((stats.share || 0) / generated) * 100).toFixed(1)}% of lines get shared` : "no lines yet";

      return res.status(200).json({ stats });
    } catch {
      return res.status(500).json({ error: "Could not read stats" });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const event = String(req.body?.event || "");
  if (!EVENTS.includes(event)) return res.status(200).json({ ok: true });
  if (!cfg) return res.status(200).json({ ok: true, storage: "not connected" });

  try {
    const guard = `warmline:rl:${today()}:stat:${clientIp(req)}`;
    const n = await redis(cfg, ["INCR", guard]);
    if (n === 1) await redis(cfg, ["EXPIRE", guard, 172800]);
    if (n > PER_IP_PER_DAY) return res.status(200).json({ ok: true });

    await redis(cfg, ["INCR", KEY(event)]);
  } catch {
    // A counter is never worth breaking the page for.
  }
  return res.status(200).json({ ok: true });
}
