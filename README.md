# The Mortician's Notebook

Static sales site for the e-book *The Mortician's Notebook* by Samuel Whitaker. Same
architecture as the Naomi Kingbird site (`naomicooks`): static pages served from the
repo root, Paddle overlay checkout, and two Netlify Functions (webhook + paid PDF
download). No build step.

## Before it can take payments — placeholders to replace

| Placeholder | Where | What |
|---|---|---|
| `morticiansnotebook.com` | every `.html`, both functions | the real Porkbun domain |
| `hello@morticiansnotebook.com` | pages, functions | contact mailbox (Porkbun forwarding + Brevo sender) |
| `@samuelwhitaker` | `index.html` and legal pages | Samuel's real YouTube handle |
| `REPLACE_PADDLE_CLIENT_TOKEN`, `REPLACE_PADDLE_PRICE_ID` | `script.js` | Paddle client-side token and price ID |
| `REPLACE_PADDLE_PRICE_ID` | `netlify/functions/paddle-webhook.mjs` | **must equal** the one in `script.js` |
| `REPLACE_UMAMI_WEBSITE_ID` | every `.html` | new Umami site |
| ``$27` / `$45` | `script.js` | price and struck-through "was" price |

Find them all: `grep -rn "REPLACE_" .`

Held outside the repo (set on the new Netlify site): `PADDLE_WEBHOOK_SECRET` (the
`pdl_ntfset_` secret, Functions scope, then redeploy), `PADDLE_API_KEY`, `BREVO_API_KEY`.

The PDF goes in Netlify Blobs: `netlify blobs:set files ebook.pdf --input <path>`.
Paddle: approve the domain, add a notification destination at `/api/paddle-webhook`
subscribed to `transaction.completed`.

## Purchase flow

Identical to Naomi's: Paddle overlay → `/download` → webhook records the order in the
`orders` blob store → `download.html` polls until ready → PDF served from `files`. The
webhook also emails the buyer a download link.

## Content notes

The price ranges on the page are rounded U.S. planning figures, not quotes. Check them
against the finished book before launch. Page count and chapter titles are not
claimed beyond the eight parts listed in `index.html`; update them from the manuscript.

## Local preview

`npx netlify dev`
