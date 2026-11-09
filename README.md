# The Mortician's Notebook

Static sales site for the e-book *The Mortician's Notebook* by Samuel Whitaker. Same
architecture as the Naomi Kingbird site (`naomicooks`): static pages served from the
repo root, Paddle overlay checkout, and two Netlify Functions (webhook + paid PDF
download). No build step.

## Before it can take payments — placeholders to replace

| Placeholder | Where | What |
|---|---|---|
| `mrmortician.com` | every `.html`, both functions | the real Porkbun domain |
| `hello@mrmortician.com` | pages, functions | contact mailbox (Porkbun forwarding + Brevo sender) |

| `live_55b9495a5ba8668b0abf409e647`, `pri_01m70g5ktsc0bhkpg0fr05gz8e` | `script.js` | Paddle client-side token and price ID |
| `pri_01m70g5ktsc0bhkpg0fr05gz8e` | `netlify/functions/paddle-webhook.mjs` | **must equal** the one in `script.js` |
| `2b437199-9756-40e7-a5e1-df31898b2b24` | every `.html` | new Umami site |
| ``$27` / `$45` | `script.js` | price and struck-through "was" price |

Find them all: `grep -rn "REPLACE_" .`

Held outside the repo (set on the new Netlify site): `PADDLE_WEBHOOK_SECRET` (the
`pdl_ntfset_` secret, Functions scope, then redeploy), `PADDLE_API_KEY`, `BREVO_API_KEY`.

The PDF goes in Netlify Blobs: `netlify blobs:set files ebook.pdf --input <path>`.
Paddle: approve the domain, add a notification destination at `/api/paddle-webhook`
subscribed to `transaction.completed`.

## Buyer email

The webhook only records the order. `netlify/functions/send-pending-emails.mjs` runs
every 5 minutes and emails (confirmation text + the PDF attached + download link) any
buyer who has not downloaded from the thank-you page within 5 minutes. Downloading
from the page marks the order in the `downloaded` store, which suppresses the email;
the `mailed` store prevents duplicates. Grace period: `GRACE_MINUTES` in that file.

The thank-you page finds the transaction from the URL, or from `localStorage` (saved at
`checkout.completed`) because Paddle's own redirect carries no transaction id.

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
