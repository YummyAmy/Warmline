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
// Sized against a real budget: $5/month, $7 hard limit in the console.
//
// Cost per opener, measured on Haiku 4.5 (~2,900 in, ~60 out):
//   uncached      ~$0.0033
//   cache hit     ~$0.00067   <- 5x cheaper, see cache_control further down
//
// 200/day was always the intent and it is affordable again now that the rules
// block is cached:
//   200/day, cache hitting, EVERY day  = ~$4.00/month   <- worst realistic case
//   200/day, no cache at all           = ~$19/month     <- what it was before
//   normal traffic                     = pennies
//
// This is a CEILING, not a forecast. It exists so that one bad actor, or one
// unexpectedly good day on LinkedIn, cannot empty the balance. Hitting it is a
// good problem: visitors get a graceful message and an email capture, not an
// error, and it resets at midnight UTC.
//
// THE REAL BACKSTOP IS THE CONSOLE. Anthropic Console -> Billing -> Limits.
// Set it to $7. That is the only control that survives a bug in this file, a
// Redis outage, or a mistake by whoever edits this next.
const PER_IP_PER_DAY = 20;    // one visitor can't drain everyone else's day
const GLOBAL_PER_DAY = 200;   // ~$4/month if fully used every single day

function today() {
  return new Date().toISOString().slice(0, 10); // "2026-07-30"
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.headers["x-real-ip"] || "unknown";
}

// If Redis is unconfigured or down, the limits above cannot run and spending
// would be unbounded until the console limit catches it. This is a partial net:
// Vercel reuses a warm function instance across many requests, so a runaway
// gets stopped on that instance at least. It is not shared between instances
// and it resets on a cold start, which is precisely why the hard spend limit in
// the Anthropic console matters more than any line of code in this file.
let fallbackCount = 0;
let fallbackDay = "";
function fallbackLimit() {
  const d = today();
  if (d !== fallbackDay) {
    fallbackDay = d;
    fallbackCount = 0;
  }
  fallbackCount += 1;
  return fallbackCount > GLOBAL_PER_DAY ? "global" : null;
}

// Returns a refusal reason, or null if the request is allowed through.
async function checkLimits(cfg, ip) {
  if (!cfg) return fallbackLimit(); // storage not connected

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
    // A Redis hiccup shouldn't take the tool down, but it also shouldn't remove
    // every limit, so fall back to the in-process counter rather than to zero.
    return fallbackLimit();
  }
  return null;
}
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Writer not configured" });
  }

  // NOTE: the request body still carries a "banned" array from the page. It is
  // deliberately NOT read here. See the BANNED_WORDS block below for why.
  const { row = {}, tone = "", toneKey = "", offer = "" } = req.body || {};

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

  // SECURITY / COST. This list used to be taken from the request body, capped
  // at 80 items but with NO limit on how long each item could be. A crafted
  // request with 80 strings of 10,000 characters would have built a 216,000
  // token prompt, costing about $0.22 for that ONE call. The daily cap counts
  // REQUESTS, not tokens, so 200 of those would have been ~$43 in a day and
  // the cap would have happily allowed every one of them.
  //
  // The list now lives here, on the server, and the request body is ignored.
  // Two other things fall out of that: the cached prefix below is guaranteed
  // byte-identical on every call (so the cache always hits), and nobody can
  // inject text into the prompt through this field.
  // Keep this in sync with the BANNED array in index.html.
  const BANNED_WORDS = [
    "era", "really", "it's not just", "not only", "it isn't about",
    "it's not about", "whether or not", "actually", "at scale", "chunk",
    "real", "scalable", "leverage", "seamless", "synergy", "robust",
    "cutting-edge", "game-changer", "I hope this email finds you well",
    "I hope this finds you well", "I came across", "reaching out because",
    "circle back", "touch base", "unlock", "supercharge", "elevate", "empower",
    "delve", "congrats", "hit close to home", "close to home", "resonated",
    "struck a chord", "spot on", "nailed it", "food for thought",
    "made me think", "than I expected", "than I meant to",
    "than I'd like to admit", "better than most", "tighter than most",
    "one of the few", "rare to see", "navigating", "structural",
    "failure modes", "unpack", "landscape", "ecosystem", "journey",
    "worth writing up", "write it up together", "hop on a call",
    "pick your brain",
  ];
  const banList = BANNED_WORDS.join(", ");

  // --- Per-tone benchmarks ----------------------------------------------------
  // The tone description alone was too vague, so every tone drifted back to the
  // same flat "I saw you did X and you're using Y" shape. These are the actual
  // pass/fail examples for each tone, written the way a person would write them.
  const which = ["warm", "direct", "technical", "executive"].includes(String(toneKey))
    ? String(toneKey)
    : "";

  // If they just shipped something, saying nothing about it is the coldest
  // possible opening. Congratulate first, then get to the point.
  const mentionsLaunch = /\blaunch(ed|ing|es)?\b|\bshipp?(ed|ing)\b|\brelease[ds]?\b/i.test(
    `${detail} ${company}`
  );

  // The full tone section now lives in the CACHED block below, because it never
  // changes. All the request carries is which tone was picked.
  const toneNames = {
    warm: "WARM",
    direct: "DIRECT",
    technical: "TECHNICAL",
    executive: "EXECUTIVE",
  };
  const toneLabel = which ? toneNames[which] : "";

  const launchRule = mentionsLaunch
    ? `\nThey have just launched or shipped something. Open by congratulating them on it in your own words, in a full sentence, before anything else. Say "congratulations", never "congrats".\n`
    : "";
  // ---------------------------------------------------------------------------

  // Everything below never changes from one request to the next, so it goes in
  // a CACHED system block. Anthropic charges a tenth of the normal input price
  // to read a cached prefix, and this prefix is about 2,500 tokens, which is
  // where nearly all the cost of this tool lives. Caching it is the difference
  // between roughly $19/month and roughly $4/month at the same traffic.
  // Do not interpolate anything per-prospect in here or the cache stops hitting.
  const systemRules = `You write the FIRST LINE of a cold outreach message — the opener that proves it isn't spam. Not the whole message. Just one or two sentences that show real attention to this specific person.

THE SHAPE OF EVERY LINE. Four parts, in this order, no exceptions:
1. A solid beginning. A real opening sentence with a subject and a verb, not a fragment and not a restatement of their own announcement.
2. Something specific, named. It does not have to be a problem. It can be a decision they made, a number, a choice of wording, a thing they shipped. Name it plainly enough that they'd know you actually looked.
3. A solution, a suggestion, or a question. Give them something to do with the line. Point at where you'd look, offer one small specific thing, or ask something you'd genuinely want answered.
4. A smooth, natural finish. The last words belong to them. No trailing clause, no sign-off energy, no summary of yourself.

Read it back before you return it. It must sound like a relaxed human talking when they are not under pressure. Unhurried, plain, a little bit ordinary. If it sounds like a person performing interest, or like a paragraph assembled in one breath, rewrite it.

This must read like one human talking to another human. Picture it: you just ran into this person at a park on a hot Thursday and you've got 20 seconds to say something real before the moment passes. Slightly caught off guard, completely genuine, zero rehearsed-pitch energy.

Voice rules:
- Write the way you'd text a smart friend about something they made. Plain words, real sentences, contractions always.
- Every sentence gets a subject. "I saw the error on your dashboard," never "Saw the error on your dashboard." Dropping the "I" reads like a telegram, not a person.
- Use ordinary verbs for noticing. "I saw," "I read," "I noticed." NOT "I caught," "I spotted," "I clocked," "I came across." The fancy verb is you performing attentiveness instead of paying it.
- Hedge like a person who is guessing, because you are. You have one detail and nothing else. "I think it's," "looks like," "my guess is," "might be." A real person who half-knows something says so.
- One sentence is usually enough. Add a second only if it says something the first didn't.
- Stop when the point lands. Don't tack on another clause with "and" to soften the ending.
- NEVER end with a trailing "which" clause. Not ", which is the thing I help with," not ", which looks like a process problem," not ", which is why I'm writing." That comma-and-which tail is the loudest machine rhythm there is. If the second thought is worth having, give it a full stop and its own sentence. Two clean sentences always beat one that keeps going.
- Full stops are free. Use them. A line that breathes reads like speech; a line held together by commas reads like a paragraph generated in one exhale.
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
- No establishing your own credentials: "from my own work building X," "I've dealt with this myself," "in my experience," "I've seen this before," "recognized those problems from my own work." That turns their thing into a springboard for your resume.
  There IS a version of this that works, and the difference is what the sentence is FOR. Mentioning you're in the same situation in order to earn a question is fine: "since I'm working through the same question right now" is honest and it makes the question reasonable to ask. Listing your experience to establish authority is not fine. Shared situation, yes. Credentials, no.
- No telling them they're doing it wrong. "You're spending way more time on this than you need to," "you're leaving money on the table," "that's costing you." Describe what you saw, not how badly they're handling it. "You're spending more time on reporting" is an observation. "More time than you need to" is a stranger grading them.
- No offering to collaborate, meet, hop on a call, or "write it up together" unless the outreach reason above explicitly says so. Proposing to co-create with a stranger is presumptuous and instantly reads as a pitch.
- No consultant vocabulary: "navigating," "structural," "failure modes," "unpack," "surface" as a verb, "landscape," "space," "ecosystem," "journey."
- NEVER these words or phrases, no exceptions, not even buried mid-sentence: ${banList}.
  Before you return anything, reread your line once and check it against that list word by word. If one is in there, rewrite the line. This gets missed more than any other rule here.
- No "it's not X, it's Y" or "not just X, but Y" or "isn't about X, it's about Y." Say the point straight.
- No rule-of-three lists ("simple, fast, and human"). Pick one word, or write a real sentence.
- No "I hope this email finds you well." No "I came across your profile." No "just wanted to reach out."

Shape:
- Open with THEM. Reference the detail like it actually stuck with you.
- Vary how you start. Don't default to "Your [thing]..." every time.
- One vivid specific beats three vague compliments.
- If you're guessing about them, don't. Only say what the detail actually supports.
HOW IT ENDS. This matters more than how it starts, and it is where machine writing gives itself away:
- The last thing in the line must point at THEM, not at you. End on a question you actually want answered, or one small offer to do a specific thing together. Never end on a statement about what you do, what you help with, or what you're good at.
- A line that ends "...which is the kind of thing I help people fix" is a brochure. A line that ends "...if you want to go through it together, I'm happy to" is a person. Same information, opposite effect.
- Real questions are allowed and encouraged: "what do you think a reasonable floor is?", "do you already have a fix for it?", "have you tried X?" A question hands them something easy to reply to, which is the entire point of an opener.
- Offers must be small, specific and easy to refuse. "We could look at your scripts together if you want." Not "I'd love to hop on a call." Not "let's connect."
- If no reason for reaching out was given above, don't invent an offer. End on a genuine question instead.
- LEAVE A DOOR OPEN. If the detail describes a problem, gesture at WHERE you'd look first without explaining the fix. Name the direction, never the solution. "I think it's the way the workflows are sequencing" opens a door. "You need to reorder your workflow triggers so the sync runs last" closes it, and they no longer need to reply.
  The opener's only job is to earn a reply. Give them one specific thing they'll want to hear more about, and stop talking. If you find yourself explaining, cut the sentence.
  Never fake this. Only point at something the detail actually supports. A vague tease ("I have some ideas") is worse than saying nothing.

Three real pairs. Left is what a machine produced. Right is how an actual person rewrote it. Study what changed:

1. MACHINE: "I saw the error on your dashboard and I'm thinking it might be connected to how your workflows are sequencing, which is actually the thing I help people fix."
   HUMAN:   "I saw the error on your dashboard and I'm thinking it might be connected to how your workflows are sequencing. I can help you check and fix that."
   CHANGED: the trailing "which" clause became its own sentence, and the vague "the thing I help people fix" became a direct offer to this specific person.

2. MACHINE: "I saw your Q3 numbers and I think you're spending way more time on reporting than you need to, which looks like a workflow automation problem."
   HUMAN:   "I saw your Q3 numbers and it seems like you're spending more time on reporting. It looks like a workflow automation problem. If you want to go through your scripts, I'd like to do that with you."
   CHANGED: the judgment ("way more than you need to") is gone, the "which" tail became a full sentence, and it now ends with an offer instead of a diagnosis.

3. MACHINE: "I read your piece on intercoder drift and recognized those failure modes from my own work on automating the messy parts of annotation workflows."
   HUMAN:   "I read your piece on intercoder drift and those problems come up when I automate parts of annotation workflows too. Do you have a fix for it already? If not, we could work through it together."
   CHANGED: "recognized from my own work" (a credential) became "comes up for me too" (a shared situation), and the line now ends with a question to them rather than a fact about the writer.

The pattern in all three: full stops instead of trailing clauses, no grading them, and the last words belong to them. Copy that posture, not these words.

THE FOUR TONES. Each one below has a GOLD line written by the person who built
this tool. That line is the target. Match its shape, its manners and its
temperature. Do not copy its words. Under each is the exact failure that tone
keeps producing, and why it fails, so you can catch it in your own draft.

WARM
  GOLD: "A big congratulations on your launch, and launch thread Friday. I was interested in the pricing-by-outcome section and the comments were interesting. I'd like to know what you think is a good baseline for new product owners as I'm building one myself."
  What that does: congratulates first, names the one section it actually read, then asks a real question and gives an honest reason for asking. Glad-to-have-run-into-you, not vague and complimentary.
  FAILS: "I saw that Dunkin' just launched those new flavors and you're using the numbers to figure out who's actually trying them."
  Why: it hands their own news back to them and stops. No purpose, no direction, nothing. It is "I saw you did this, blah blah blah." There is nothing in it for them to reply to.

DIRECT
  GOLD: "Your error/bug on your most recent dashboard caught my attention. I can work you through some extensions that can be helpful in 15-30 minutes, or show you how to fix it."
  What that does: names the thing in the first clause, then offers something concrete and time-boxed. No wind-up, and still a person rather than a telegram.
  FAILS: any line that summarises their situation and stops, or that ends on a description of what you do for a living.
  Why: direct means the point arrives early, not that the line is colder or emptier. Confident, not clipped.

TECHNICAL
  GOLD: "Congratulations on the launch of your latest flavor and for always raising the bar. I'd like to know how you're pulling segments like launch numbers if there's a pipeline best practice you're using. I'm hands-on with automation and will appreciate an opportunity to talk about it with you."
  What that does: congratulates first, asks a peer-level question about METHOD, mentions its own hands-on experience only so far as it makes the question reasonable to ask, then closes plainly and without pressure.
  FAILS: "I saw you're using the new flavor launch numbers to find which customers are most likely to try it again, and my guess is you're manually pulling those segments instead of automating them."
  Why: "my guess is you're manually pulling" is a stranger assuming they work badly, from one sentence of evidence. That is generic, not technical, and it asks nothing. Technical means asking about method as an equal. Never diagnose them.

EXECUTIVE
  GOLD: "I saw some of your Q3 numbers, and I believe I can halve your reporting time and expenses."
  What that does: short, specific, carries a claim worth answering, and treats the reader as someone who decides things.
  FAILS: "I saw you just launched a new drink flavor and you're using the numbers to find which customers to target with it."
  Why: no beginning, no middle, no humanity, no warmth, no leadership, nothing. It says "I saw your launch and your numbers" and then stops. So what? A real CEO or COO reads that and moves on without a thought. Executive is NOT shorter-and-colder. It is authority plus warmth: acknowledge the move and what it took, say the one thing that actually matters about it, close like a peer.

THE NORTH STAR, for every tone. Most people talk the same way when they are not
under pressure: unhurried, plain, a little bit ordinary, saying the thing and
then stopping. That is the voice. The reader should finish the line and think it
sounds like something they would have written themselves on a good day. If your
draft sounds like a tool performing interest, or like a paragraph assembled in
one breath, it has failed no matter how correct it is.

THE FAILURE PATTERN THAT KILLS EVERY TONE. This is the one to hunt for in your own draft:
  "I saw that Dunkin' just launched those new flavors and you're using the numbers to figure out who's actually trying them."
That line has no purpose, no direction and nothing behind it. It is "I saw you did this, blah blah blah" dressed up. It reads like a bot summarising their homepage back to them. If your line is a restatement of something they already know about themselves, with nothing asked and nothing offered, throw it out and write a different one.
`;

  // The per-request half. Small, cheap, and deliberately kept out of the cached
  // block above so that block stays byte-identical on every call.
  const userMessage = `Prospect:
- Name: ${name || "(unknown)"}
- Company/newsletter: ${company || "(unknown)"}
- Detail I know about them: ${detail || "(none given)"}

${offerText ? `What I'm reaching out about: ${offerText}` : ""}

Tone: ${toneText}.
${toneLabel ? `\nWrite this one in the ${toneLabel} tone. Go back to the ${toneLabel} entry in the tone section, read its GOLD line and its FAILS line again, and make sure your draft sits with the GOLD one and nowhere near the FAILS one.\n` : ""}${launchRule}
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
        // Haiku costs about a third of Sonnet for this job. If the openers ever
        // start reading flat, put "claude-sonnet-4-6" back here and redeploy.
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        // cache_control marks the rules block as reusable. The first call in a
        // five minute window pays a small premium to write the cache; every
        // call after that reads it at a tenth of the input price. Bursty launch
        // traffic is the best possible shape for this, which is exactly when
        // the bill would otherwise hurt.
        system: [
          {
            type: "text",
            text: systemRules,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userMessage }],
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
      // Every dash character a model reaches for: em, en, figure, minus,
      // horizontal bar, and the typed "--". Covers spaced and unspaced use,
      // so both "word — word" and "word—word" are caught.
      .replace(/\s*(--+|[—–―‒−])\s*/g, ", ")
      // A dash opening the line leaves a stray comma at the front.
      .replace(/^\s*,\s*/, "")
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
