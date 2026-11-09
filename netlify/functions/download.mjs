// Serves the e-book PDF, but only for a transaction ID that the Paddle
// webhook has recorded as paid. The PDF itself lives in Netlify Blobs
// (store "files", key "ebook.pdf"), never in the public site.
//
//   GET /api/download?txn=txn_...&check=1  -> { ready: true|false }
//   GET /api/download?txn=txn_...          -> the PDF
import { getStore } from '@netlify/blobs';

const FILENAME = 'The-Morticians-Notebook-Samuel-Whitaker-2026.pdf';
const HELP = 'Please email hello@mrmortician.com with your Paddle receipt and we will send your e-book.';

const PRICE_ID = 'pri_01m70g5ktsc0bhkpg0fr05gz8e'; // must match script.js and paddle-webhook.mjs

// If the webhook has not recorded the order (late, failed, misconfigured), ask
// Paddle directly. Only a transaction that Paddle reports as paid, for this
// book's price, counts, so a guessed ID is still refused.
async function paidAtPaddle(txn) {
  const apiKey = (process.env.PADDLE_API_KEY || '').trim().replace(/^Bearer\s+/i, '');
  if (!apiKey) return null;
  try {
    const r = await fetch(`https://api.paddle.com/transactions/${txn}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) { console.error('[download] paddle lookup %s -> %s', txn, r.status); return null; }
    const t = (await r.json())?.data;
    const paid = t && ['completed', 'paid'].includes(t.status);
    const isBook = (t?.items || []).some(i => i.price?.id === PRICE_ID);
    return paid && isBook ? { paidAt: t.billed_at || new Date().toISOString(), customerId: t.customer_id } : null;
  } catch (err) {
    console.error('[download] paddle lookup failed', err);
    return null;
  }
}

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export default async req => {
  const url = new URL(req.url);
  const txn = url.searchParams.get('txn') || '';
  const checkOnly = url.searchParams.has('check');

  if (!/^txn_[a-z0-9]{20,40}$/.test(txn)) {
    return checkOnly ? json({ ready: false, error: 'invalid' }, 400) : new Response(`This download link is not valid. ${HELP}`, { status: 400 });
  }

  // Strong consistency: the webhook may have written this order a second ago.
  const orders = getStore({ name: 'orders', consistency: 'strong' });
  let order = await orders.get(txn);
  if (!order) {
    const verified = await paidAtPaddle(txn);
    if (verified) { await orders.setJSON(txn, verified); order = true; }
  }
  if (!order) {
    return checkOnly ? json({ ready: false }) : new Response(`We could not find a completed payment for this order yet. ${HELP}`, { status: 404 });
  }
  if (checkOnly) return json({ ready: true });

  const pdf = await getStore('files').get('ebook.pdf', { type: 'arrayBuffer' });
  if (!pdf) return new Response(`The e-book file is temporarily unavailable. ${HELP}`, { status: 500 });

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${FILENAME}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
};

export const config = { path: '/api/download' };
