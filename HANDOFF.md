### Warmline (handoff notes)

Written 31 July 2026. Owner: Amy (@YummyAmy), maxiusifoh@gmail.com for chat,
ameikpe@yahoo.com for GitHub/Vercel/VS Code.

---

### What it is

Single-page web app. Visitor(s) types a name, a company and a detail
about a person they want to cold-email. 
Warmline returns a one to two personalized/customized sentences opening line. 
AI-tell phrases banned.
#### Free for first 15 Warmline(s) per visitor, no signup, 15 per browser.

Part of the "data according to me" brand.

### Live URLs

- Production: **https://warmline.dataaccordingtome.com**
- Vercel fallback: https://warmline-xi.vercel.app
- Repo: https://github.com/YummyAmy/warmline (private)

---

### Stack

| Piece | What |
|---|---|
| `index.html` | front end. HTML, CSS and JS in one file. All images are base64 inline. **1.7MB.** |
| `api/write.js` | Calls the Anthropic API server-side so the key is never in the browser. Holds tonal/voice rules. |
| `api/count.js` | Reads the global opener counter |
| `api/incr.js` | Increments it |
| `api/subscribe.js` | Saves emails from the signup box |
| `api/comments.js` | Comment wall |
| Storage | Upstash Redis, added through the Vercel Marketplace |
| Hosting | Vercel, auto-deploys on push to `main` |

No `package.json`, no `node_modules`, no build step. The API routes talk to
Upstash over plain HTTPS with `fetch`, deliberately, so nothing needs installing.
**If you swap Upstash for a TCP Redis you must rewrite all four routes.**

---

#### Costly gotchas

#### 1. Commit author email (broke deployment for a day)

Vercel matches the git commit author to a GitHub account. On the Hobby plan with
a private repo, an unrecognised author gets the build **Blocked**, not failed,
and the site quietly keeps serving the old version.

The repo is configured with:

```
git config user.email "43475176+YummyAmy@users.noreply.github.com"
```

**Do not change this to a personal address** unless that address is a verified
email on the GitHub account. `maxiusifoh@gmail.com` is not, and using it blocks
every deploy.

#### 2. DNS

Namecheap, `dataaccordingtome.com`, on **Namecheap BasicDNS**.

- `warmline` CNAME points at the value Vercel issued for this project
- The two `@` records are **Zoho email**. Don't delete.
- Vercel issues a different CNAME target per domain. If the domain is re-added,
  re-read the value, don't reuse the old one.

#### 3. Budget, and why the rate limits are low

Anthropic account holds **$4.98 prepaid with auto-reload OFF**. That's a spend cap, not a setting.

Roughly half a cent per opener on Sonnet, about a third of that on Haiku. So:

```js
const PER_IP_PER_DAY = 20;    // ~10c max from one visitor
const GLOBAL_PER_DAY = 200;   // ~$1/day, so $5 lasts ~5 days
```

These were originally 40 and 1500. 1500/day is **$7.65**, more than the entire
balance, so a high traffic (if possible) would have emptied it in one day. Do not raise these
without checking the balance first.

Model is currently `claude-haiku-4-5-20251001`. The Sonnet model string is in a
comment directly above it if the writing quality ever drops.

#### 4. Prompt caching

Vercel/Anthropic will nag about enabling it. **Don't.** At this traffic most
calls miss the 5 minute cache window, and cache writes cost more than normal
tokens. It would raise the bill, not lower it.

---

### Tone home

Two places, and they are different things:

- **`api/write.js`** — the instruction prompt, inside the backticks. This is the
  substance: no em-dashes, no "exact/exactly", hedge instead of claiming
  certainty, no trailing "which" clauses, end on a question or a small offer,
  don't grade the recipient, no credential flexing.
- **`index.html`**, search `const BANNED=[` — a flat list of forbidden words
  passed into the prompt on each call.

The prompt contains three worked before/after pairs taken from the owner's own
rewrites. Those examples do more work than the rules. If you tune the voice,
add pairs rather than more bullet points.

**Status: the current rules are deployed but have never been evaluated.** That
is the single most important open item.

---

### Open decisions

**The name.** "Warmline" is also the established term for mental health peer
support phone lines. She will not rank for the bare word and shouldn't try, both
because it's futile and because someone in distress landing on a sales tool
serves nobody. Options discussed: keep it and never optimise for the bare term,
see alternatives, or rename while there are no users. Undecided.

**Copy split.** Currently:
- `<title>` — Warmline. First lines that sound like you.
- `og:title` — Where robots don't eat your words.
- `og:description` — Write one real detail about someone you want to reach...
- Page kicker — she prefers `warm outreach . human voice`; the file may still
  say `cold outreach . human voice`. Check and align.

No `twitter:` tags, by request. Open Graph only. LinkedIn, WhatsApp, Slack,
iMessage and Substack all read OG.

---

### Known problems, in priority order

1. **`index.html` is 1.7MB in one file.** Every image is base64 inline, so
   nothing paints until all of it lands. On mobile data this is the biggest
   single thing hurting the product. Extract images to real files.
2. **The tool is below the fold.** A visitor meets a headline and a "how it
   works" section before reaching the thing. Ideally someone can type one detail
   and get a warmline without scrolling.
3. **Three input fields plus a tone picker** is a lot to face cold.
4. **The counter reads 1.** Social proof that low is worse than none. Hide it
   until it clears fifty.
5. Nothing animates. The result appears all at once.

---

### Assets

`social/` holds the marketing graphics and the Python that generates them:

- `hero-card.png` + `card_v2.py` — phone with the illustration on screen, copy
  beside it, light marble. The current preferred layout.
- `card-green-girl.png`, `warmline-steps-mockup.png`, `warmline-hero-mockup.png`,
  `warmline-square.png`, `warmline-story.png`, `warmline-marble-post.png`
- `illo-forest/gold/duo.png` + `duotone.py` — a watercolour illustration mapped
  into the brand palette
- `what-people-see.png` — simulation of the link preview

Root holds `share-card.png` (the live `og:image`), `favicon.svg`,
`favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`.

Brand values, taken from `index.html`:

```
--paper #f3efe4   --ink #1b2a24     --ink-soft #4a5a51
--green #1d6e4f   --green-deep #0f4d36
--gold  #e0a324   --pink #d85a7a    --line #d8d1bf
```

Georgia for headings, Courier New for mono labels, Inter for body.

---

### Working note for whoever picks this up

She is precise about what she wants and describes it clearly. The failure mode
on this project has been an assistant treating "adjust this image" as "design a
new one." When she says rework something, change only the named thing and show
her the result. Don't substitute your own concept.

She is shipping her first product on a $5 budget while job hunting. Small
unresolved details cause real anxiety. Close loops rather than opening new ones.
