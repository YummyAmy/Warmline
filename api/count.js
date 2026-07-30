// api/count.js — returns the global "openers written here" number.
// Storage: Upstash Redis (installed through the Vercel Marketplace).
// No npm packages needed — this talks to Upstash over plain HTTPS.

// The Vercel/Upstash integration sets these automatically. We check several
// possible names because the integration has used different ones over time.
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

// Runs one Redis command, e.g. redis(cfg, ["GET", "warmline:openers"])
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

export const COUNT_KEY = "warmline:openers";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cfg = redisConfig();

  // If storage isn't connected yet, don't crash the page — just report zero.
  if (!cfg) return res.status(200).json({ count: 0, storage: "not connected" });

  try {
    const raw = await redis(cfg, ["GET", COUNT_KEY]);
    const count = parseInt(raw || "0", 10) || 0;
    // Let browsers cache for 30s so a busy page doesn't hammer Redis.
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ count });
  } catch {
    return res.status(200).json({ count: 0, storage: "unavailable" });
  }
}
