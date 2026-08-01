# Warmline V2 — the paid tier

The free tool proves the idea. V2 is what someone pays for. Written so it can
be built in stages, cheapest-risk first, without breaking the live free site.

## What people pay for (from the product notes)

The flagship paid feature is **company research** — the thing the notes list as
"Company research integration." Free Warmline writes from the one detail you
type. Paid Warmline *also looks the company up* and works a real, current fact
into the opener that you didn't have to supply. That is the clearest reason to
pay, and it's the one competitors can't fake with a template.

Secondary paid features already named: unlimited openers, CSV import (paste a
list, get a warmline for each row), and later the LinkedIn / recruiter / follow-up
variants.

## The three pieces V2 needs

### 1. A way to take payment — Stripe, not Gumroad

Gumroad sells a file or a license link. Warmline sells *more access on the site*,
so the tool is Stripe.

The flow, in plain terms:
1. Visitor clicks "Upgrade" on the site.
2. They land on a **Stripe Payment Link** (a URL Stripe gives you — you make it
   in the Stripe dashboard, no code). Stripe collects the card. You never touch
   card details, and neither does Claude.
3. Stripe sends a "someone paid" message to a small endpoint on your site
   (`api/stripe-webhook.js`). That endpoint writes the payer's email into Redis:
   `warmline:paid:<email> = <date>`.
4. From then on, `write.js` checks that key. If the email is marked paid, it
   skips the 15-line limit and turns on company research.

What you set up (not code, dashboard clicks): a Stripe account, one Product
(e.g. "Warmline Unlimited, $9/mo"), one Payment Link, and one webhook pointing
at `https://warmline.dataaccordingtome.com/api/stripe-webhook`. Stripe gives you
two secrets — a webhook signing secret and an API key — that go into Vercel
environment variables, exactly like `ANTHROPIC_API_KEY`. Claude cannot enter
these for you; you paste them into Vercel yourself.

### 2. Company research — the paid magic

New endpoint `api/research.js` (scaffolded alongside this plan, inert until
wired). Given a company name it does one web search, pulls the single most
recent concrete fact (a launch, a hire, a number, a post), and hands that back.
`write.js` then feeds that fact into the prompt so the opener references
something real and current.

Cost reality: this roughly triples the per-opener cost (a search plus a longer
prompt). That is exactly why it's paid, not free. On the free tier it would
drain the $5 in an afternoon; on the paid tier the customer covers it.

### 3. Knowing who paid

Free stays free, 15 per browser, no login. Paid users are identified by the
email they paid with. Simplest V2: after paying, they get a link with their
email token, or they enter the email they paid with once and the browser
remembers it. No passwords, no accounts to build. (A real login can come later;
don't build it for V2.)

## Build order (cheapest risk first)

1. **Stripe Payment Link + a real "Upgrade" button** that goes to it. No backend
   yet. You can literally start taking money before the gating exists, and mark
   the first few payers by hand. Proves someone will pay.
2. **`api/stripe-webhook.js`** — writes `warmline:paid:<email>` on payment.
3. **Paid check in `write.js`** — if paid, skip the 15 limit.
4. **`api/research.js`** + wire it into `write.js` for paid users only.
5. **CSV import** in the UI for paid users.

Ship 1 and 2, then stop and see if anyone pays before building 4.

## What NOT to do in V2

- No user accounts or passwords. Email-on-file is enough.
- No company research on the free tier — it will bankrupt the $5.
- Don't raise the free rate limits to cover research; gate research behind paid.

## The homepage line, from the notes (worth using verbatim)

> A warmline is a personalized opening sentence for cold outreach.
> Tell us who you're contacting. We'll write the opener. You write the rest.

Clearer than anything currently on the site. The "cold email / warmline" pairing
reads like a category, not a feature — lean on it.
