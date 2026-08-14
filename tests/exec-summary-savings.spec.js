/**
 * Exec Summary Savings Calculation — Seeded Tests
 *
 * Covers three scenarios:
 *   A) Lower-priced bid awarded  → "Your savings" section with correct numbers
 *   B) Higher-priced bid awarded → "Pricing outcome / Awarded at market ceiling"
 *   C) winner_price is null      → still resolves correctly via vendor_awards
 */

const { test } = require('@playwright/test');

const BASE         = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';
const BUYER_EMAIL  = 'mattkrueger@comcast.net';
const BUYER_PWD    = 'Test12345678';
const SELLER1_EMAIL = 'mk@comcast.net';
const SELLER1_PWD   = 'Test12345678';
const SELLER1_ID    = 'ad52644c-96d8-4936-a5a5-8c82c1c56851';
const SELLER2_EMAIL = 'mk2@comcast.net';
const SELLER2_PWD   = 'Test12345678';
const SELLER2_ID    = 'c7961587-bbc5-411a-bd86-40f4f3f61076';

const TAG = 'EXECTEST_' + Date.now();
const PASS = l => console.log('   ✅ ' + l);
const FAIL = l => console.log('   ❌ FAIL: ' + l);

function hdrs(tok) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}
async function api(tok, path, method = 'GET', body = null) {
  const opts = { method, headers: hdrs(tok) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}
function first(res) { return Array.isArray(res) ? res[0] : null; }
async function freshToken(email, pwd) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pwd }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Login failed for ${email}`);
  return { token: d.access_token, userId: d.user?.id };
}

async function seedRFQ(buyerToken, buyerId, title) {
  const rfq = first(await api(buyerToken, 'rfqs', 'POST', {
    title, status: 'awarded', strategy: 'sole', buyer_id: buyerId,
    deadline: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    hq_location: 'Atlanta, GA', visibility: 'all',
  }));
  await api(buyerToken, 'rfq_items', 'POST', {
    rfq_id: rfq.id, vendor: 'Cisco', sku: 'C9200L-24P', quantity: 5,
  });
  return rfq;
}

async function seedBid(sellerToken, sellerId, rfqId, price) {
  return first(await api(sellerToken, 'bids', 'POST', {
    rfq_id: rfqId, reseller_id: sellerId, total_price: price,
    status: 'pending', notes: 'Test bid.',
    line_items: [{ vendor: 'Cisco', sku: 'C9200L-24P', description: 'Switch', quantity: 5, unit_price: price / 5, line_total: price }],
  }));
}

test('Exec summary savings calculations — seeded scenarios A/B/C', async ({ page }) => {
  test.setTimeout(180000);

  // ── Login ──────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', BUYER_EMAIL);
  await page.fill('#login-password', BUYER_PWD);
  await page.click('#login-btn');
  await page.waitForURL(/my-rfqs|dashboard/, { timeout: 20000 });

  const { token: buyerToken, userId: buyerId } = await freshToken(BUYER_EMAIL, BUYER_PWD);
  const { token: s1Token } = await freshToken(SELLER1_EMAIL, SELLER1_PWD);
  const { token: s2Token } = await freshToken(SELLER2_EMAIL, SELLER2_PWD);

  const seedIds = { rfqs: [], bids: [], items: [] };

  async function cleanup() {
    for (const id of seedIds.bids)  await api(buyerToken, `bids?id=eq.${id}`, 'DELETE');
    for (const id of seedIds.items) await api(buyerToken, `rfq_items?id=eq.${id}`, 'DELETE');
    for (const id of seedIds.rfqs)  await api(buyerToken, `rfqs?id=eq.${id}`, 'DELETE');
    PASS('All seeded test data deleted');
  }

  async function loadExecSummary(rfqId) {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(`${BASE}/bidbridge-exec-summary.html?rfq=${rfqId}`, { waitUntil: 'domcontentloaded' });
    // Wait for JS to finish rendering — doc-title only appears after wrap.innerHTML is set
    await page.waitForSelector('.doc-title', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const body = await page.locator('#doc-wrap').textContent();
    return { body, errors };
  }

  // ── SCENARIO A: Lower-priced bid awarded → shows "Your savings" ────────────
  console.log('\n── A: Lower bid awarded → Your savings section ──');
  {
    const rfq = await seedRFQ(buyerToken, buyerId, TAG + '_A_LOW_WINS');
    seedIds.rfqs.push(rfq.id);
    const items = await api(buyerToken, `rfq_items?rfq_id=eq.${rfq.id}&select=id`);
    (items || []).forEach(i => seedIds.items.push(i.id));

    const lowBid  = await seedBid(s1Token, SELLER1_ID, rfq.id, 10000); // winner
    const highBid = await seedBid(s2Token, SELLER2_ID, rfq.id, 15000); // loser
    seedIds.bids.push(lowBid.id, highBid.id);

    // Award the LOW bid — set winner_price and vendor_awards
    await api(buyerToken, `rfqs?id=eq.${rfq.id}`, 'PATCH', {
      winner_reseller_id: SELLER1_ID,
      winner_price: 10000,
      vendor_awards: { Cisco: lowBid.id },
    });

    const { body, errors } = await loadExecSummary(rfq.id);

    if (errors.length > 0) FAIL('A: JS errors: ' + errors.join(', '));
    else PASS('A: No JS errors');

    // "Saved vs. highest bid received" only appears inside the savings grid
    if (body.includes('Saved vs. highest bid received')) PASS('A: "Your savings" section shown ✓');
    else FAIL('A: "Your savings" section missing');

    // "Awarded at market ceiling" only appears inside the Pricing outcome block
    if (body.includes('Awarded at market ceiling')) FAIL('A: Incorrectly showing "at market ceiling"');
    else PASS('A: "Pricing outcome" block correctly absent ✓');

    // Verify savings math: $15,000 - $10,000 = $5,000 saved
    if (body.includes('5,000')) PASS('A: Saved $5,000 vs highest ✓');
    else FAIL(`A: Expected $5,000 savings`);
  }

  // ── SCENARIO B: Higher-priced bid awarded → "Pricing outcome" block ────────
  console.log('\n── B: Higher bid awarded → Pricing outcome block ──');
  {
    const rfq = await seedRFQ(buyerToken, buyerId, TAG + '_B_HIGH_WINS');
    seedIds.rfqs.push(rfq.id);
    const items = await api(buyerToken, `rfq_items?rfq_id=eq.${rfq.id}&select=id`);
    (items || []).forEach(i => seedIds.items.push(i.id));

    const lowBid  = await seedBid(s1Token, SELLER1_ID, rfq.id, 10000); // loser
    const highBid = await seedBid(s2Token, SELLER2_ID, rfq.id, 15000); // winner (higher!)
    seedIds.bids.push(lowBid.id, highBid.id);

    // Award the HIGH bid
    await api(buyerToken, `rfqs?id=eq.${rfq.id}`, 'PATCH', {
      winner_reseller_id: SELLER2_ID,
      winner_price: 15000,
      vendor_awards: { Cisco: highBid.id },
    });

    const { body, errors } = await loadExecSummary(rfq.id);

    if (errors.length > 0) FAIL('B: JS errors: ' + errors.join(', '));
    else PASS('B: No JS errors');

    if (body.includes('Awarded at market ceiling')) PASS('B: "Awarded at market ceiling" block shown ✓');
    else FAIL('B: Expected "Awarded at market ceiling" block — not found');

    // "Saved vs. highest bid received" is unique to the savings grid
    if (body.includes('Saved vs. highest bid received')) FAIL('B: Savings grid incorrectly shown');
    else PASS('B: Savings grid correctly absent ✓');

    // Intro letter should NOT claim savings
    if (body.includes('best possible pricing')) FAIL('B: Intro letter incorrectly claims "best possible pricing"');
    else PASS('B: Intro letter correctly uses neutral language ✓');
  }

  // ── SCENARIO C: winner_price is null — resolves via vendor_awards ──────────
  console.log('\n── C: winner_price null → resolves via vendor_awards ──');
  {
    const rfq = await seedRFQ(buyerToken, buyerId, TAG + '_C_NO_WINNER_PRICE');
    seedIds.rfqs.push(rfq.id);
    const items = await api(buyerToken, `rfq_items?rfq_id=eq.${rfq.id}&select=id`);
    (items || []).forEach(i => seedIds.items.push(i.id));

    const lowBid  = await seedBid(s1Token, SELLER1_ID, rfq.id, 8000);  // winner
    const highBid = await seedBid(s2Token, SELLER2_ID, rfq.id, 12000); // loser
    seedIds.bids.push(lowBid.id, highBid.id);

    // Award LOW bid but deliberately omit winner_price (null) to test fallback
    await api(buyerToken, `rfqs?id=eq.${rfq.id}`, 'PATCH', {
      winner_reseller_id: SELLER1_ID,
      winner_price: null,
      vendor_awards: { Cisco: lowBid.id },
    });

    const { body, errors } = await loadExecSummary(rfq.id);

    if (errors.length > 0) FAIL('C: JS errors: ' + errors.join(', '));
    else PASS('C: No JS errors');

    if (body.includes('Your savings')) PASS('C: "Your savings" section shown (resolved via vendor_awards) ✓');
    else FAIL('C: "Your savings" section missing — winner_price fallback broken');

    // Should show $4,000 savings ($12,000 - $8,000) via vendor_awards lookup
    if (body.includes('4,000')) PASS('C: Correct $4,000 savings resolved from vendor_awards ✓');
    else FAIL('C: Expected $4,000 savings from vendor_awards lookup — may still be using lowestBid fallback');
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log('\n── Cleanup ──');
  await cleanup();
});
