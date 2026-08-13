# Warmline — handoff for a new Claude session

Written 6 August 2026. Read this whole file before touching anything.

This is the state of the project after roughly seven weeks of work, most of it
in one long Cowork session that got too expensive to continue. Everything that
mattered from that session is either in this file or in the code comments.

---

## 1. What Warmline is

A single-page web tool. You type a person's name, their company, and one real
detail you know about them, pick a tone, and it writes the FIRST LINE of a cold
outreach message in a human voice. Not the whole email. Just the opener that
proves it isn't spam.

- **Live at:** https://warmline.dataaccordingtome.com
- **Repo:** https://github.com/YummyAmy/Warmline (capital W)
- **Host:** Vercel, auto-deploys on push to `main`
- **Owner:** Amy / Ame (@YummyAmy). Data scientist, not a web developer.
- **Launched:** 6 August 2026. This is her first shipped product.

---

## 2. Ground rules for working on this

These are not preferences. They were learned the hard way.

1. **Never rewrite a whole file.** Make surgical edits. Match the existing
   syntax, style and patterns exactly. The code is deliberately dense and
   heavily commented; keep both.
2. **She commits and pushes herself.** Edit files in the local folder so they
   show as modified in VS Code. Do not run git commands that write.
3. **When she asks you to fix something, modify THAT thing.** Do not regenerate
   it from scratch. Rebuilding is how she ended up with cards in the wrong
   fonts and had to spend prompts explaining it.
4. **Voice decisions are hers.** Never change the wording of generated-line
   examples, the banned list, or site copy tone without asking. Typos and
   factual inaccuracies you may fix directly.
5. **The budget is $5 a month. Not per day.** She is unemployed. Do not quote
   theoretical worst-case numbers at her as if they were bills; state the
   realistic figure first.
6. **Quality of the generated lines beats everything.** She would rather serve
   fewer people better. She has iterated on the voice rules more than a dozen
   times and cares about single adverbs.
7. **You cannot see the page.** Every visual change should be mocked as an
   artifact first, or verified by asking her for a screenshot. A CSS bug that
   would be obvious in one glance cost a whole round trip.

---

## 3. Stack and file map

Static HTML plus Vercel serverless functions. **No build step, no framework, no
dependencies.** `package.json` exists only to declare `"type": "module"` and
silence a Vercel warning.

| File | What it is |
|---|---|
| `index.html` | The entire site. Markup, CSS and JS in one file, ~1,100 lines. |
| `api/write.js` | The writer. Prompt, spend guards, post-processing. **The heart of the product.** |
| `api/stats.js` | Analytics counters. GET with admin key to read. |
| `api/subscribe.js` | Newsletter + v2.0 waitlist emails. |
| `api/comments.js` | Visitor notes. Pending queue, manual approval. |
| `api/count.js` | Public "warmlines written here" counter. |
| `api/research.js` | **Dormant v2 scaffold.** Gated off, see section 7. |
| `terms.html` `privacy.html` `data-processing.html` | Full legal set. Delaware law. |
| `robots.txt` `sitemap.xml` | SEO basics. |
| `social/` | Post images. Untracked by git, local only. Not used by the site. |
| `HANDOFF.md` `README.md` `V2_PLAN.md` | Her own notes. Do not overwrite. |

---

## 4. The voice engineering — this is the actual product

Anyone can call an API. What makes Warmline hers is ~5,900 tokens of layered
rules in `api/write.js`, built from her own line-by-line rewrites of failing
outputs. **Do not "tidy" this. Do not shorten it to save money.**

Rules currently enforced, roughly in order of importance:

- **Length: 2 to 4 sentences.** A single sentence is called out as too little.
  (An old rule saying "one sentence is usually enough" was silently producing
  thin lines for weeks. It is gone. Do not reintroduce anything like it.)
- **Never a bare question.** A line whose whole payload is "I saw X and I'd
  like to know Y" gives the reader nothing. Preference order: a real point of
  view first; failing that, a specific question PLUS a concrete offer.
- **The intensifier rule.** "Actually" only works when it corrects an
  expectation the reader already holds, which a cold opener never sets up.
  Same test for "really", "genuinely", "truly". **And deleting the intensifier
  is only half the fix** — it is a symptom that the adjacent word is vague.
  Replace the vague word with a precise one: "something that actually feels
  different" → "something intuitive".
- **Assertive adverbs banned as a class:** usually, clearly, typically,
  generally, obviously, certainly, definitely, simply, basically, essentially,
  literally. They sound like knowledge and are not. An adverb survives only if
  removing it changes the meaning.
- **No dashes at all.** Em, en, figure, minus, and typed `--`. Enforced twice:
  in the prompt, and mechanically in post-processing. Ordinary hyphens survive.
- **"Actually" is also stripped mechanically**, because the ban alone kept
  failing.
- **Time is numeric and usually a range:** "15-20 minutes", "2-3 months".
- **Verbs for noticing.** Good: I saw, I noticed, I read, I looked at, I looked
  up, I studied, I've been following. Banned: I watched, I caught, I spotted,
  I clocked, I came across.
- **Say "your", not "that".** Cut "that kind of", "those", "right now", "yet".
- **No "it's not X, it's Y"** in any disguise, including "rather than",
  "less about A and more about B", "X, not Y".
- **Four tones, each with a GOLD example and its exact failure mode.** The gold
  lines came from her. Executive is specifically "diagnosis and a clear offer",
  not shorter-and-colder.
- **A banned-phrase list of 56 items** lives on the server in `write.js` and is
  mirrored in `index.html` for readability. **Keep both in sync.**
- **Six of her own before/after rewrites** are in the prompt verbatim, with the
  specific move named in each. These are the highest-signal thing in the file.

**Unresolved contradiction:** "really" is on the banned list, but her own gold
example keeps "I really like how you've built something". She has been asked
twice and not decided. Leave it alone until she does.

---

## 5. Money — the numbers, current as of 6 Aug 2026

- **Model:** `claude-sonnet-5`. Deliberate. Every failure has been an
  instruction-following failure, and Haiku dropped the quiet rules.
- **Prompt caching is on.** The ~5,900-token rules block is a cached `system`
  block; only the prospect fields change per call. This is what makes Sonnet
  affordable. Do not interpolate anything per-prospect into that block or the
  cache stops hitting and costs go up 10x.
- **Cost per line:** ~$0.0027 (Sonnet 5 introductory pricing).
- **Caps:** `PER_IP_PER_DAY = 25`, `GLOBAL_PER_DAY = 250`.
- **A 250-line spike day:** ~$0.66. **A realistic month:** ~$1-2.
- **The real guarantee is the Anthropic console spend limit**, not the caps.
  Caps only stop one strange day eating the month.

**⚠️ 1 SEPTEMBER 2026: Sonnet 5 introductory pricing ends** ($2/$10 → $3/$15,
about +50%). Check spend around then. If it has moved too far, put
`claude-haiku-4-5-20251001` back on the model line and redeploy — that alone
cuts the bill by roughly two thirds and nothing else changes.

---

## 6. Security work already done — do not undo any of this

- **Prompt injection via the banned list (was the big one).** The list used to
  come from the request body, capped at 80 items but with no limit on item
  length. A crafted request could have built a 216,000-token prompt costing
  $0.22 for one call, and the daily cap counts requests, not tokens. It now
  lives server-side and the request body is ignored.
- Every input field is length-capped server-side.
- `toneKey` is validated against a whitelist.
- Rate limits on `write`, `subscribe`, `comments` and `stats`.
- If Redis is unreachable the limits fall back to an in-process counter rather
  than disappearing entirely.
- The API key is server-side only; the page never sees it.
- Submitted notes are stripped of markup and escaped on render, and held in a
  pending queue rather than published automatically.

---

## 7. Admin endpoints

All need `ADMIN_SECRET` set in Vercel → Settings → Environment Variables, then
a **redeploy** (env vars only reach builds made after they exist).

| URL | Shows |
|---|---|
| `/api/stats?key=SECRET` | visits, lines generated, example clicks, shares, tone split, conversion % |
| `/api/subscribe?key=SECRET` | newsletter + waitlist emails. Waitlist ones tagged `(waitlist)` |
| `/api/comments?key=SECRET` | notes awaiting approval |
| `/api/count` | public counter, no key |

**To publish a note:** Upstash console → Data Browser →
`LPUSH warmline:comments:approved {"name":"X","text":"Y"}`. Approved notes
appear ahead of the five hardcoded starter notes, which never disappear.

**`api/research.js` is dormant and must stay that way.** It is a v2 search
scaffold. It requires BOTH a search key AND `RESEARCH_ENABLED=true`. Do not set
that variable until the route has its own rate limiting and a paid-status
check, or it becomes an open endpoint spending her search credits.

---

## 8. Known gotchas

- **`.git/index.lock`** reappears constantly. `rm -f .git/index.lock` clears it.
- **The repo is `Warmline` with a capital W.** Remote URL has been corrected.
- **`pull.rebase true`** is set. Cause of past push rejections was editing files
  directly on github.com, which creates commits the laptop doesn't have.
- **Her Zoho mailbox `amy@dataaccordingtome.com` is locked out** (OneAuth MFA
  loop, two years unused). It is still the contact address on all three legal
  pages, which promise a 30-day response. She has asked for it to stay as-is
  and will fix it herself. **Do not swap it for a personal address.**
- **CSS lesson worth remembering:** a full-bleed band using
  `transform: translateX(-50%)` collided with a `.reveal` class that set
  `transform: translateY(...)` on the same element. Later rule won, the band
  flew half a screen right. Check for property collisions before adding
  transform-based animation to anything positioned.
- **She dislikes heavy visual treatments.** A full-bleed dark green section was
  built and reverted the same day: too loud, and it washed out the "Generic AI"
  card that people need to be able to read.

---

## 9. What was just added and is not yet proven in the wild

Deployed 6 Aug, needs a real check:

- **Sealed example card.** Uneditable demo with typing animation, four fixed
  tone outputs, no API call, doesn't consume anyone's free 15.
- **Share button** beside copy. Native share sheet on mobile, clipboard on
  desktop.
- **Analytics** (`api/stats.js`) — verify counters increment after a visit.
- **Scroll reveal** on six sections below the tool, with three separate
  failsafes so content can never be left hidden.
- **Card depth** on the comparison and audience cards.

---

## 10. Next steps, in priority order

1. **Set `ADMIN_SECRET` and redeploy.** Nothing in section 7 works until this
   is done. It was in progress when the old session ended.
2. **Verify analytics are recording.** Load the site, then hit
   `/api/stats?key=...` and confirm `visit` incremented.
3. **Build `/admin.html`.** One page, key pasted once, shows analytics +
   subscribers + pending notes formatted instead of raw JSON. Offered, not
   built. Roughly 20 minutes.
4. **The 20-second marketing video.** Plan agreed: record the site on her
   iPhone (vertical 9:16), edit in CapCut, no voiceover, structure is
   hook → typing → tone tap → line lands → URL. Not started.
5. **Footer side margins look empty.** Two candidate fixes: widen `.foot-cols`
   from 1000px to match the tool's 1420px, or move one background illustration
   down there. Needs a screenshot to diagnose.
6. **Two variants per generation** — same tone, two options, user picks. Agreed
   as a paid-tier feature since it doubles cost per generation. Picking is also
   the best quality signal available.
7. **v2.0 / paid tier.** No billing exists. Waitlist is collecting emails
   tagged `(waitlist)`. Do not build billing before the list justifies it. If
   someone insists on paying now, a Gumroad product on her existing
   `amyu.gumroad.com` is 15 minutes and zero code.
8. **Around 1 September: the Sonnet pricing decision.** See section 5.

---

## 11. Things she has said that are worth remembering

- "It has to sound like a human is talking, not AI slop and language."
- "I want them to read it and imagine it sounds JUST like them."
- On the FAQ framing she keeps returning to: *if you met a CEO for the first
  time, what would you say and how would you say it?*
- She is doing this partly to be seen. It is her first shipped product and she
  is hoping it helps her land work. Small wins are reassuring to her; do not be
  falsely encouraging, but do not be cold about it either.

---

## 12. Best single line the tool has produced

Useful as a quality bar. Prospect: Janet at Chinet, detail "new cup redesign,
the lid rim looks reshaped", Warm tone.

> "Janet, congratulations on the new cup redesign. I noticed the lid rim looks
> like it's been reshaped for a better grip, which is a small thing most
> companies skip. Was that driven by customer complaints about spills, or more
> of an internal usability push?"

Why it works: it names something physical, says why it matters, and asks a
question only someone who thought about it would ask, offering two plausible
answers so it is easy to reply to. **Note that the input detail was concrete.**
Abstract details ("increasing sales even though they are a small company")
still produce weaker lines. The most useful unbuilt improvement to the page may
be a hint under that field telling people to be physical and specific.
