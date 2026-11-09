// Receives Paddle webhooks. On transaction.completed for the e-book price,
// records the transaction ID as paid so /api/download will serve the PDF, then
// emails the buyer their download link.
//
// The email matters more than it looks. Paddle's own receipt carries no link to
// the download page, and Paddle's successUrl redirect arrives without a
// transaction id — so a buyer who closes the tab, or whose browser blocks the
// redirect, otherwise has no way back to the book they paid for.
//
// Sending is best-effort and never changes the response: a non-2xx here would
// make Paddle retry for days and send duplicate emails without fixing anything.
//
// Environment:
//   PADDLE_WEBHOOK_SECRET  signing secret of the notification destination
//   PADDLE_API_KEY         server-side key; the payload carries customer_id, not the address
//   BREVO_API_KEY          Brevo transactional email key (used in ../lib/receipt.mjs)
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { sendReceiptOnce } from '../lib/receipt.mjs';

const PRICE_ID = 'pri_01m70g5ktsc0bhkpg0fr05gz8e';
const MAX_AGE_SECONDS = 5 * 60; // reject old, replayed webhooks

// Paddle-Signature: "ts=1671552777;h1=abc..." (several h1 values while a secret is rotated)
function isValidSignature(rawBody, header, secret) {
  let ts = '';
  const hashes = [];
  for (const part of header.split(';')) {
    const [key, value] = part.split('=');
    if (key === 'ts') ts = value;
    if (key === 'h1' && value) hashes.push(value);
  }
  if (!ts || !hashes.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_AGE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest();
  return hashes.some(h => {
    const given = Buffer.from(h, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export default async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return new Response('Webhook secret not configured', { status: 500 });

  const rawBody = await req.text();
  if (!isValidSignature(rawBody, req.headers.get('paddle-signature') || '', secret)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event.event_type === 'transaction.completed') {
    const txn = event.data;
    const boughtBook = (txn.items || []).some(item => item.price?.id === PRICE_ID);
    if (boughtBook) {
      await getStore('orders').setJSON(txn.id, {
        paidAt: event.occurred_at,
        customerId: txn.customer_id,
      });
      console.log('[paddle] STORED order %s', txn.id);
      // Best-effort, and never allowed to change the response: a non-2xx would
      // make Paddle retry for days and resend this email each time.
      try {
        console.log('[paddle] receipt %s %s', txn.id, await sendReceiptOnce(txn));
      } catch (err) {
        console.error('[paddle] receipt failed %s', txn.id, err);
      }
    }
  }

  return new Response('ok');
};

export const config = { path: '/api/paddle-webhook' };
