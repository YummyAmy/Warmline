// api/incr.js — adds 1 to the global "openers written here" number.
// Called by api/write.js after a line is successfully written.

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

const COUNT_KEY = "warmline:openers";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cfg = redisConfig();
  if (!cfg) return res.status(200).json({ count: 0, storage: "not connected" });

  try {
    // INCR is atomic: two people finishing at the same moment both get counted.
    const count = await redis(cfg, ["INCR", COUNT_KEY]);
    return res.status(200).json({ count });
  } catch {
    // Never let a counter problem break the actual tool.
    return res.status(200).json({ count: 0, storage: "unavailable" });
  }
}
