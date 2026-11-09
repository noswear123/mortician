// Buyer email, shared by the webhook and the download page's fallback so a paid
// order gets exactly one email whichever of them notices it first.
//
// Environment: PADDLE_API_KEY (customer lookup), BREVO_API_KEY (sending)
import { getStore } from '@netlify/blobs';

const SITE = 'https://mrmortician.com';
const FROM = { name: "The Mortician's Notebook", email: 'hello@mrmortician.com' };

// The transaction.completed payload carries customer_id, not the address.
async function buyerEmail(txn) {
  if (txn.customer?.email) return txn.customer.email;
  const apiKey = (process.env.PADDLE_API_KEY || '').trim().replace(/^Bearer\s+/i, '');
  if (!apiKey || !txn.customer_id) return null;
  const r = await fetch(`https://api.paddle.com/customers/${txn.customer_id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) return null;
  return (await r.json())?.data?.email || null;
}

function mailBody(link) {
  return `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#16140F;max-width:520px">
  <p>Thank you for buying <i>The Mortician's Notebook</i>.</p>
  <p><a href="${link}" style="display:inline-block;background:#7D5C17;color:#F6F1E7;padding:14px 26px;border-radius:6px;text-decoration:none;font-weight:bold">Download your e-book</a></p>
  <p>Or paste this into your browser:<br><span style="color:#726856">${link}</span></p>
  <p>Your e-book is attached to this email as a PDF, and you can also download it
     from the link above.</p>
  <p>Keep this email &mdash; the link stays valid, so you can download the e-book
     again whenever you need it.</p>
  <p>If the link ever stops working, just reply to this email and we will send your
     e-book straight over.</p>
  <p>With respect,<br>&mdash; Samuel Whitaker</p>
</div>`;
}

// The PDF is attached so the buyer has it even if the link is lost. A missing
// file only costs the attachment; the link in the email still works.
async function ebookAttachment() {
  const pdf = await getStore('files').get('ebook.pdf', { type: 'arrayBuffer' });
  if (!pdf) return [];
  return [{ name: 'The-Morticians-Notebook-Samuel-Whitaker-2026.pdf', content: Buffer.from(pdf).toString('base64') }];
}

async function sendReceipt(txn) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) return 'no_brevo_key';

  const to = await buyerEmail(txn);
  if (!to) return 'no_email';

  const attachment = await ebookAttachment();
  const link = `${SITE}/download?txn=${encodeURIComponent(txn.id)}`;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: FROM,
      to: [{ email: to }],
      subject: "Your copy of The Mortician's Notebook",
      htmlContent: mailBody(link),
      ...(attachment.length ? { attachment } : {}),
    }),
  });
  return r.ok ? 'sent' : `brevo_${r.status}`;
}


// Claim the order before sending so the webhook and the download page cannot both
// send; release the claim if sending fails so a later attempt can retry.
export async function sendReceiptOnce(txn) {
  const mailed = getStore({ name: 'mailed', consistency: 'strong' });
  if (await mailed.get(txn.id)) return 'already_sent';
  await mailed.set(txn.id, new Date().toISOString());
  let result;
  try { result = await sendReceipt(txn); } catch (err) { await mailed.delete(txn.id); throw err; }
  if (result !== 'sent') await mailed.delete(txn.id);
  return result;
}
