# Warmline — hand-off brief for Cowork

Paste this to Cowork when you start, so it has full context.

## What this is
Warmline: a single-page website + an AI cold-outreach tool. The visitor writes
one real detail about a prospect and gets an opening line in a human voice,
with "robot words" banned. Free, no signup. By Amy (data analyst).

## Files
- index.html   — the entire page (HTML/CSS/JS). Images are embedded as base64.
- api/write.js — the AI call (Anthropic API), runs server-side, key stays hidden.
- api/count.js, incr.js, subscribe.js — global counter + optional email capture.
- README.md    — public, safe for GitHub.
- NOTES_PRIVATE_do_not_push.md — Amy's private notes (gitignored).

## What I need help with (in order)
1. Deploy to Vercel with my ANTHROPIC_API_KEY, and set a $5/month spend cap
   at console.anthropic.com.
2. Fill placeholder links (see NOTES_PRIVATE): GitHub repo, Upwork profile,
   footer socials, template card URLs, legal pages.
3. Publish to a PRIVATE GitHub repo.
4. Test on a real phone via the Vercel URL.

## Brand / voice (keep consistent)
- Colors: cream bg, forest green, gold, pink accent. Georgia headings,
  Courier mono labels.
- Voice: human, anti-"beige AI," no robot phrases. Name = Warmline,
  tagline "data according to me". Logo scrolls to top.

## Known constraints
- The tool can't be pinned static (it's taller than the screen); the
  "How it works" steps advance on scroll instead — this is intentional.
- Tool errors ("couldn't reach the writer") are expected until deployed.
