# Warmline Architecture Overview

This project is a lightweight static web app with a serverless API layer. The browser renders the interface directly from static assets, while AI generation and analytics are handled server-side.

```mermaid
flowchart TD
    U[User / Visitor] --> B[Browser
    index.html
    static assets
    localStorage]

    B --> H[Warmline UI
    HTML + CSS + JS
    tone selection
    15-free-limit tracking]

    H --> W[/api/write.js
    generates opener]
    H --> C[/api/count.js
    total usage count]
    H --> S[/api/stats.js
    analytics events]
    H --> CM[/api/comments.js
    social proof comments]
    H --> SUB[/api/subscribe.js
    newsletter / waitlist capture]

    V[Vercel Hosting
    serves static site
    runs serverless functions] --> H
    V --> W
    V --> C
    V --> S
    V --> CM
    V --> SUB

    W --> L[Request validation
    rate limits
    banned-word checks
    tone rules]
    L --> A[Anthropic Claude API
    generates opening line]
    A --> W

    W --> R[(Upstash Redis / KV)
    request counters
    analytics records
    comment storage
    usage tracking]
    C --> R
    S --> R
    CM --> R
    SUB --> R

    B --> LS[Browser localStorage
    free-credit counter
    page state]

    classDef app fill:#eaf7ee,stroke:#2d6a4f,color:#1b2a24;
    classDef api fill:#eef4ff,stroke:#3a5a9d,color:#1b2a24;
    classDef data fill:#fff2d9,stroke:#b7791f,color:#1b2a24;
    classDef external fill:#f5f0ff,stroke:#6c5ce7,color:#1b2a24;

    class U,B,H app;
    class W,C,S,CM,SUB,V,L api;
    class R,LS data;
    class A external;
```

## Key architectural characteristics

- Static frontend: The main experience is served as a self-contained HTML/CSS/JS app with no build step.
- Serverless API layer: Generation and supporting data endpoints live under the `api/` directory and run on Vercel.
- AI generation: `api/write.js` calls Anthropic Claude to generate an opening line based on the user-provided details and selected tone.
- Data and limits: Redis-backed counters enforce per-IP and global daily limits and store usage/analytics data.
- Privacy-conscious flow: The API key is kept server-side rather than exposed to the browser.
- No signup default: The app provides a small free quota before prompting for more advanced features or waitlist capture.

## Request flow

1. A visitor loads the static page and interacts with the Warmline UI.
2. The browser sends requests to serverless endpoints in `api/`.
3. Those endpoints validate input, apply rate limits, and call Claude for generation.
4. The generated response is returned to the browser and rendered in the UI.
5. Stored counts and event metrics are kept in Redis for usage insights and operational controls.

## Repository fit

This repo structure matches the `Warmline` product model:

- `index.html` and static assets form the user-facing experience.
- `api/*.js` contain the serverless business logic.
- `vercel.json` wires the app into deployment.
- Redis-backed services provide persistent state without a full backend service layer.
