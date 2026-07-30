# Warmline

Write one real detail about a prospect and get
back an opening line that sounds like a person wrote it. (AI fillers and robotic words are banned).
Built as a single self-contained page. Free to use, no signup.

## Run locally
Open `index.html` in a browser. The page renders fully; the AI line-writing
runs once deployed with an API key (see below).

## Deploy
1. A free [Vercel](https://vercel.com) account (sign in with GitHub).
2. Import this repo (or drag the folder into Vercel).
3. Add an environment variable: `ANTHROPIC_API_KEY` = your key.
4. Deploy.

## Stack
Plain HTML/CSS/JS, single file. The AI call runs server-side in `api/write.js`
so the key is never exposed to the browser.

## License
[choose one — MIT, or "All rights reserved"]
