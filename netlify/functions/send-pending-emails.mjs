// Runs every few minutes. A buyer who has not downloaded the book from the
// thank-you page within GRACE_MINUTES gets the confirmation email with the
// e-book attached. Buyers who did download it (download.mjs marks them) are
// skipped, and the 'mailed' store stops anyone being emailed twice.
import { getStore } from '@netlify/blobs';
import { sendReceiptOnce } from '../lib/receipt.mjs';

const GRACE_MINUTES = 10;
const GIVE_UP_DAYS = 3;

export default async () => {
  const orders = getStore({ name: 'orders', consistency: 'strong' });
  const downloaded = getStore({ name: 'downloaded', consistency: 'strong' });
  const now = Date.now();
  const { blobs } = await orders.list();

  for (const { key } of blobs) {
    try {
      const order = await orders.get(key, { type: 'json' });
      const paidAt = Date.parse(order?.paidAt || '');
      if (!paidAt) continue;
      const ageMin = (now - paidAt) / 60000;
      if (ageMin < GRACE_MINUTES || ageMin > GIVE_UP_DAYS * 1440) continue;
      if (await downloaded.get(key)) continue;
      const result = await sendReceiptOnce({ id: key, customer_id: order.customerId });
      console.log('[pending-email] %s %s', key, result);
    } catch (err) {
      console.error('[pending-email] failed %s', key, err);
    }
  }
};

export const config = { schedule: '*/5 * * * *' };
