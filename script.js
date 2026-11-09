// ---- Site settings ----
const PRICE = '$27';               // what the customer actually pays — keep in sync with Paddle
const PADDLE_TOKEN = 'live_55b9495a5ba8668b0abf409e647';   // client-side token, safe to publish
const PADDLE_PRICE_ID = 'pri_01m70g5ktsc0bhkpg0fr05gz8e';

// ---- Offer display ----
// PRICE_WAS is struck through wherever PRICE appears. 27 is 40% off 45.
// Set PRICE_WAS to '' to remove the strike-through and the badges everywhere.
const PRICE_WAS = '$45';
const DISCOUNT_PCT = '40%';
// If the saving is a real Paddle discount rather than only a label, put its code
// here and it is applied automatically, so the Paddle overlay shows the same
// before/after figures as the page. Leave '' to send the customer straight to PRICE.
const CHECKOUT_DISCOUNT_CODE = '';

document.querySelectorAll('[data-price]').forEach(el => { el.textContent = PRICE; });
document.querySelectorAll('[data-discount]').forEach(el => { el.textContent = DISCOUNT_PCT; });
// No former price configured: strip the offer treatment rather than leave it blank.
document.querySelectorAll('[data-offer]').forEach(el => {
  if (!PRICE_WAS) { el.remove(); return; }
  el.querySelectorAll('[data-price-was]').forEach(w => { w.textContent = PRICE_WAS; });
  if (el.hasAttribute('data-price-was')) el.textContent = PRICE_WAS;
});



// ---- Sales popup: once per visitor, 15 seconds after the first visit ----
const POPUP_DELAY = 15000;
const popup = document.getElementById('popup');
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
function closePopup() {
  if (!popup || popup.hidden) return;
  popup.hidden = true;
  document.body.classList.remove('has-popup');
}
if (popup && !store.get('popupSeen')) {
  const first = Number(store.get('firstVisit')) || Date.now();
  store.set('firstVisit', first);
  setTimeout(() => {
    if (document.querySelector('.paddle-frame')) return; // already in checkout
    popup.hidden = false;
    document.body.classList.add('has-popup');
    store.set('popupSeen', '1');
    popup.querySelector('.popup__close').focus();
    if (window.umami) umami.track('Popup shown');
  }, Math.max(0, first + POPUP_DELAY - Date.now()));
  popup.addEventListener('click', e => {
    if (e.target === popup || e.target.closest('[data-popup-close]')) closePopup();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopup(); });
}

// ---- Checkout: Buy -> Paddle overlay -> /download ----
// If Paddle.js fails to load, the buttons keep their #order link as a fallback.
if (window.Paddle) {
  Paddle.Initialize({
    token: PADDLE_TOKEN,
    eventCallback: e => {
      const track = (name, data) => { if (window.umami) umami.track(name, data); };
      if (e.name === 'checkout.loaded') track('Checkout opened');
      if (e.name === 'checkout.closed') track('Checkout closed without buying');
      if (e.name === 'checkout.completed' && e.data && e.data.transaction_id) {
        // Paddle's own successUrl redirect can win the race and arrive without a
        // transaction id, so the download page also reads it from here.
        store.set('lastTxn', JSON.stringify({ id: e.data.transaction_id, at: Date.now() }));
        const t = e.data.totals || {};
        track('Purchase', { revenue: t.total, currency: e.data.currency_code });
        // short pause so the Purchase event is sent before leaving the page
        setTimeout(() => { location.href = '/download?txn=' + encodeURIComponent(e.data.transaction_id); }, 400);
      }
    },
  });
  document.querySelectorAll('[data-buy]').forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    closePopup();
    Paddle.Checkout.open({
      items: [{ priceId: PADDLE_PRICE_ID, quantity: 1 }],
      ...(CHECKOUT_DISCOUNT_CODE ? { discountCode: CHECKOUT_DISCOUNT_CODE } : {}),
      settings: {
        displayMode: 'overlay',
        variant: 'one-page',
        // Paddle redirects here itself, appending ?_ptxn=<transaction id>.
        // This is the fallback for when the eventCallback below does not
        // run — blocked scripts, in-app browsers, a backgrounded tab.
        successUrl: location.origin + '/download',
      },
    });
  }));
}

// ---- Scroll reveal ----
const io = 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches
  ? new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
  : null;
document.querySelectorAll('.reveal').forEach(el => io ? io.observe(el) : el.classList.add('is-in'));
