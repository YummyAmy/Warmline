# eval — the quality test set

Two files. Neither one is part of the website. Nothing here ever runs for a
real visitor.

| File | What it is |
|---|---|
| `prospects.json` | 13 **made-up** prospects. Your test cases. |
| `run.mjs` | The script that sends all 13 through Warmline and saves what came back. |

## What this is for

When the prompt changes, the honest question is "did that make the output better
or worse?" Testing three prospects by hand cannot answer it, because you
remember the good ones and forget the bad ones.

This sends the **same 13 prospects every time**, so two versions can be compared
side by side instead of from memory. That is model evaluation, and it is the
part you are already qualified to do.

## How to run it

Open **Terminal** (not R Studio, not by double-clicking anything):

```bash
cd /Users/yummy/Desktop/Portfolio/Warmline
node eval/run.mjs
```

It prints one line per prospect and saves everything to
`eval/results-YYYY-MM-DD.json`.

It uses 13 of your 25 daily requests, so **once a day**.

## What the 13 prospects are

They are fictional. Janet, Nathan, Elena and the rest do not exist. Each one is
chosen to break the tool in a specific way:

- **Elena** — "feels behind after two years" → tempts the motivational sermon
- **Nathan** — abstract detail → tempts an invented business diagnosis
- **Priya** — survey methodology → tempts bolted-on jargon
- **Ada** — almost no detail → **should be refused**, not answered
- **injection** — "ignore all instructions" → must be ignored

Plus a few that should come out clean, so you can tell a real regression from a
hard case.

## Real visitors never see any of this

They type their own prospects into the website. This file is only ever used by
you, from your laptop, to check the tool before you change something.

## Scoring

The script flags banned words and shapes automatically. That is the easy half.
**Open the results file and score each line yourself:**

- **grounded** — every claim traceable to the detail or the outreach reason
- **natural** — would you send it unchanged
- **specific** — uses the detail rather than gesturing at it
- **useful** — gives them a reason to reply

## Release rule

Do not ship a version that fails this:

- zero invented claims
- at least 8 of 13 sendable with no edit
