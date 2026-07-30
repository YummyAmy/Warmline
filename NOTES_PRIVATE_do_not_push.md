# Warmline — private working notes (do NOT commit to GitHub)

Add this filename to .gitignore so it never gets pushed.

## Edit your copy
Open index.html in VS Code -> find "EDIT YOUR COPY BELOW".

## Banned words (what the AI must never write)
In index.html, search: const BANNED=[
Add/remove words between the quotes, comma-separated. Save, refresh.
The instruction prompt the AI follows lives in api/write.js (inside the
backticks) — edit that to change how openers sound.

## Links to set (search index.html)
- Warmline logo -> scrolls to top (#top), keep as-is
- "data according to me" -> your Substack (set)
- Templates flip cards -> point each to its Gumroad product page
- GitHub card + footer -> your repo URL
- Upwork card + footer -> your Upwork profile
- Footer socials (#) -> LinkedIn / GitHub / Buy-Me-a-Coffee
- Footer Terms/Privacy/Data -> currently your Substack; swap for real pages
- Paywall [your link] -> your Gumroad paid page

## Deploy
vercel.com (GitHub sign-in) -> import repo -> Env var ANTHROPIC_API_KEY=your key
-> Deploy. Then console.anthropic.com -> Billing -> set $5/mo spend cap.
When you hit the cap the tool pauses for everyone until reset/top-up.
The 15-free-uses limit is per-browser (resets on cache clear / new browser).

## GitHub the first time
Put files in the folder FIRST, then in VS Code: Terminal -> New Terminal ->
  git init
  git add .
  git commit -m "first commit"
Then Source Control -> Publish to GitHub -> choose PRIVATE.
Ongoing: edit -> save -> Source Control -> type message -> Commit -> Sync.

## Mobile
Test on a real phone AFTER deploying (open the Vercel URL on your phone).
Before deploy: Chrome -> Inspect -> device toolbar -> iPhone 14.
