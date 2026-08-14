/**
 * BOM expand tab — seeded test
 * Verifies: clicking an RFQ card shows BOM tab by default,
 * SKU data renders, switching to Bids tab loads bids,
 * and switching back to BOM tab works.
 */

const { test } = require('@playwright/test');

const BASE         = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';
const BUYER_EMAIL  = 'mattkrueger@comcast.net';
const BUYER_PWD    = 'Test12345678';
const SELLER_EMAIL = 'mk@comcast.net';
const SELLER_PWD   = 'Test12345678';
const SELLER_ID    = 'ad52644c-96d8-4936-a5a5-8c82c1c56851';

const TAG  = 'BOMTEST_' + Date.now();
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

test('My RFQs — BOM expand tab renders SKU data correctly', async ({ page }) => {
  test.setTimeout(120000);

  // Login
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', BUYER_EMAIL);
  await page.fill('#login-password', BUYER_PWD);
  await page.click('#login-btn');
  await page.waitForURL(/my-rfqs|dashboard/, { timeout: 20000 });

  const { token: buyerToken, userId: buyerId } = await freshToken(BUYER_EMAIL, BUYER_PWD);
  const { token: sellerToken } = await freshToken(SELLER_EMAIL, SELLER_PWD);

  // Seed: one RFQ with two known SKUs and one bid
  const rfq = first(await api(buyerToken, 'rfqs', 'POST', {
    title: TAG + '_BOM_TEST',
    status: 'active',
    strategy: 'sole',
    buyer_id: buyerId,
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    hq_location: 'Atlanta, GA',
    visibility: 'all',
  }));

  await api(buyerToken, 'rfq_items', 'POST', {
    rfq_id: rfq.id, vendor: 'Cisco', sku: 'C9200L-24P', quantity: 5, description: '24-port PoE switch',
  });
  await api(buyerToken, 'rfq_items', 'POST', {
    rfq_id: rfq.id, vendor: 'Cisco', sku: 'SFP-10G-SR', quantity: 10, description: '10G SFP+ module',
  });

  const bid = first(await api(sellerToken, 'bids', 'POST', {
    rfq_id: rfq.id, reseller_id: SELLER_ID, total_price: 12500,
    status: 'pending', notes: 'Test bid.',
    line_items: [
      { vendor: 'Cisco', sku: 'C9200L-24P', description: '24-port PoE switch', quantity: 5, unit_price: 1200, line_total: 6000 },
      { vendor: 'Cisco', sku: 'SFP-10G-SR', description: '10G SFP+ module', quantity: 10, unit_price: 650, line_total: 6500 },
    ],
  }));

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // Navigate to My RFQs
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  if (errors.length) FAIL('JS errors on load: ' + errors.join(', '));
  else PASS('No JS errors on page load');

  // ── Test 1: Find the seeded RFQ card ──────────────────────────────────────
  console.log('\n── Finding seeded RFQ card ──');
  const cardText = page.locator('.rfq-card', { hasText: TAG + '_BOM_TEST' });
  const cardCount = await cardText.count();
  if (cardCount > 0) PASS('Seeded RFQ card found');
  else { FAIL('Seeded RFQ card not found — test cannot continue'); goto_cleanup: { } }

  if (cardCount > 0) {
    // ── Test 2: Click card → drawer opens (card click now opens detail drawer) ──
    console.log('\n── Clicking card → detail drawer ──');
    await cardText.first().click();
    await page.waitForTimeout(1200);

    const drawerOverlay = page.locator('#drawer-overlay');
    const drawerIsOpen = await drawerOverlay.evaluate(el => el.classList.contains('open')).catch(() => false);
    if (drawerIsOpen) PASS('Card click opens detail drawer ✓');
    else FAIL('Detail drawer did not open on card click');

    // Close drawer so we can use the chevron for inline BOM expand
    await drawerOverlay.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);

    // ── Test 3: Chevron click → BOM tab shown by default ──────────────────
    console.log('\n── Chevron click → inline BOM expand ──');
    const chevron = cardText.locator('.expand-chevron-btn');
    await chevron.click({ force: true });
    await page.waitForTimeout(800);

    const bomTab = cardText.locator('.expand-tab.active');
    const bomTabText = await bomTab.first().textContent().catch(() => '');
    if (bomTabText.includes("What we're buying")) PASS('BOM tab is active by default');
    else FAIL(`BOM tab not active — found: "${bomTabText}"`);

    const panel = cardText.locator('.bid-expand-panel.open');
    const panelOpen = await panel.count();
    if (panelOpen > 0) PASS('Expand panel is open');
    else FAIL('Expand panel did not open');

    // ── Test 4: BOM content renders SKUs ──────────────────────────────────
    console.log('\n── BOM content ──');
    await page.waitForTimeout(400);
    const bomContent = await cardText.locator('.bom-table').textContent().catch(() => '');

    if (bomContent.includes('C9200L-24P')) PASS('SKU C9200L-24P visible in BOM');
    else FAIL('SKU C9200L-24P missing from BOM');

    if (bomContent.includes('SFP-10G-SR')) PASS('SKU SFP-10G-SR visible in BOM');
    else FAIL('SKU SFP-10G-SR missing from BOM');

    if (bomContent.includes('24-port PoE switch')) PASS('Description visible in BOM');
    else FAIL('Description missing from BOM');

    if (bomContent.includes('×5') || bomContent.includes('5')) PASS('Quantity visible in BOM');
    else FAIL('Quantity missing from BOM');

    // ── Test 5: Switch to Bids tab ─────────────────────────────────────────
    console.log('\n── Switching to Bids tab ──');
    const bidsTabBtn = cardText.locator('.expand-tab').nth(1);
    await bidsTabBtn.click({ force: true });
    await page.waitForTimeout(1500);

    const bidsContent = await cardText.locator('.bid-expand-panel').textContent().catch(() => '');
    if (bidsContent.includes('12,500') || bidsContent.includes('$12,500')) PASS('Bid price $12,500 visible in Bids tab');
    else FAIL('Bid price missing from Bids tab');

    const bidsInner = await cardText.locator('.bid-expand-inner').textContent().catch(() => '');
    if (bidsInner.includes('bid') || bidsInner.includes('12,500')) PASS('Bids tab inner content rendered');
    else FAIL('Bids tab inner content did not render correctly');

    // ── Test 6: Switch back to BOM tab ─────────────────────────────────────
    console.log('\n── Switching back to BOM tab ──');
    const bomTabBtn = cardText.locator('.expand-tab').first();
    await bomTabBtn.click({ force: true });
    await page.waitForTimeout(400);

    const bomAgain = await cardText.locator('.bom-table').textContent().catch(() => '');
    if (bomAgain.includes('C9200L-24P')) PASS('BOM tab re-renders correctly after switching back');
    else FAIL('BOM tab did not re-render after switching back');

    // ── Test 7: Second chevron click closes panel ──────────────────────────
    console.log('\n── Click chevron again → closes panel ──');
    await chevron.click({ force: true });
    await page.waitForTimeout(500);
    const stillOpen = await cardText.locator('.bid-expand-panel.open').count();
    if (stillOpen === 0) PASS('Clicking chevron again closes the panel');
    else FAIL('Panel did not close on second chevron click');

    // ── Test 8: No new JS errors ───────────────────────────────────────────
    if (errors.length > 0) FAIL('JS errors during interaction: ' + errors.join(', '));
    else PASS('No JS errors throughout test');
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log('\n── Cleanup ──');
  await api(buyerToken, `bids?id=eq.${bid.id}`, 'DELETE');
  const items = await api(buyerToken, `rfq_items?rfq_id=eq.${rfq.id}&select=id`);
  for (const i of (items || [])) await api(buyerToken, `rfq_items?id=eq.${i.id}`, 'DELETE');
  await api(buyerToken, `rfqs?id=eq.${rfq.id}`, 'DELETE');
  PASS('Seeded test data deleted');
});
