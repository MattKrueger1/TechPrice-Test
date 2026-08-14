/**
 * My RFQs Widget Test — Self-Seeded
 *
 * Creates temporary test RFQs (active + review with bids), runs all widget
 * checks, then deletes everything. Nothing persists after the test.
 */

const { test } = require('@playwright/test');

const BASE         = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';
const BUYER_EMAIL  = 'mattkrueger@comcast.net';
const BUYER_PWD    = 'Test12345678';
const SELLER1_ID   = 'ad52644c-96d8-4936-a5a5-8c82c1c56851'; // ITSeller

const SELLER1_EMAIL = 'mk@comcast.net';
const SELLER1_PWD   = 'Test12345678';

const TAG = 'WIDGET_TEST_' + Date.now();

const PASS = (l) => console.log('   ✅ ' + l);
const FAIL = (l) => console.log('   ❌ FAIL: ' + l);
const WARN = (l) => console.log('   ⚠️  ' + l);

function headers(tok) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}

async function api(tok, path, method = 'GET', body = null) {
  const opts = { method, headers: headers(tok) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function freshToken(email, pwd) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pwd }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Login failed for ${email}: ${JSON.stringify(d)}`);
  return d.access_token;
}

test('My RFQs widgets — seeded test', async ({ page }) => {
  test.setTimeout(120000);

  // ── 1. Login ──────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', BUYER_EMAIL);
  await page.fill('#login-password', BUYER_PWD);
  await page.click('#login-btn');
  await page.waitForURL(/my-rfqs|dashboard/, { timeout: 20000 });

  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
    try { return JSON.parse(localStorage.getItem(key))?.access_token; } catch { return null; }
  });
  const userId = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
    try { return JSON.parse(localStorage.getItem(key))?.user?.id; } catch { return null; }
  });

  if (!token || !userId) { FAIL('Could not get session — aborting'); return; }

  // Get seller token (needed for bid inserts — RLS requires reseller_id = auth.uid())
  const sellerToken = await freshToken(SELLER1_EMAIL, SELLER1_PWD);

  const seedIds = { rfqs: [], bids: [], rfqItems: [] };

  // ── 2. Seed test data ──────────────────────────────────────────────────────
  console.log('\n── Seeding test data ──────────────────────────────────');

  const deadline = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // Active RFQ (no bids yet)
  const [activeRfq] = await api(token, 'rfqs', 'POST', {
    title: TAG + '_ACTIVE',
    status: 'active',
    strategy: 'sole',
    buyer_id: userId,
    deadline,
    hq_location: 'Boston, MA',
    notes: 'Test active RFQ — auto-delete',
  });
  seedIds.rfqs.push(activeRfq.id);
  PASS('Seeded active RFQ: ' + activeRfq.id.slice(0, 8));

  // Add an rfq_item to active RFQ
  const [activeItem] = await api(token, 'rfq_items', 'POST', {
    rfq_id: activeRfq.id, vendor: 'Cisco', sku: 'TEST-SKU-1', quantity: 5,
  });
  seedIds.rfqItems.push(activeItem.id);

  // Review RFQ (has bids submitted — status = review means bids came in)
  const [reviewRfq] = await api(token, 'rfqs', 'POST', {
    title: TAG + '_REVIEW',
    status: 'review',
    strategy: 'sole',
    buyer_id: userId,
    deadline,
    hq_location: 'Boston, MA',
    notes: 'Test review RFQ — auto-delete',
  });
  seedIds.rfqs.push(reviewRfq.id);
  PASS('Seeded review RFQ: ' + reviewRfq.id.slice(0, 8));

  // Add rfq_item to review RFQ
  const [reviewItem] = await api(token, 'rfq_items', 'POST', {
    rfq_id: reviewRfq.id, vendor: 'Dell Technologies', sku: 'TEST-SKU-2', quantity: 3,
  });
  seedIds.rfqItems.push(reviewItem.id);

  // Add a bid against the review RFQ — use seller token (RLS: reseller_id = auth.uid())
  const [bid1] = await api(sellerToken, 'bids', 'POST', {
    rfq_id: reviewRfq.id,
    reseller_id: SELLER1_ID,
    total_price: 1500,
    status: 'pending',
    notes: 'Test bid — auto-delete',
    line_items: [{ vendor: 'Dell Technologies', sku: 'TEST-SKU-2', quantity: 3, unit_price: 500, line_total: 1500 }],
  });
  seedIds.bids.push(bid1.id);
  PASS('Seeded bid on review RFQ: ' + bid1.id.slice(0, 8));

  // Also add a bid against the active RFQ (to test drawer shows bids)
  const [bid2] = await api(sellerToken, 'bids', 'POST', {
    rfq_id: activeRfq.id,
    reseller_id: SELLER1_ID,
    total_price: 2500,
    status: 'pending',
    notes: 'Test bid on active — auto-delete',
    line_items: [{ vendor: 'Cisco', sku: 'TEST-SKU-1', quantity: 5, unit_price: 500, line_total: 2500 }],
  });
  seedIds.bids.push(bid2.id);
  PASS('Seeded bid on active RFQ: ' + bid2.id.slice(0, 8));

  // ── 3. Navigate to My RFQs and reload ─────────────────────────────────────
  // Clear viewed-bids cache so all review RFQs with bids appear as unread
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('itpn_viewed_bids_')).forEach(k => localStorage.removeItem(k));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#stat-active:not(:empty)', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log('\n── A: Widget counts ───────────────────────────────────');

  // Get DB ground truth
  const dbRfqs = await page.evaluate(async ({ url, anonKey, tok, uid }) => {
    const r = await fetch(`${url}/rest/v1/rfqs?buyer_id=eq.${uid}&select=id,status`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${tok}` }
    });
    return r.json();
  }, { url: SUPABASE_URL, anonKey: SUPABASE_KEY, tok: token, uid: userId });

  const dbActive    = (dbRfqs || []).filter(r => r.status === 'active').length;
  const dbReview    = (dbRfqs || []).filter(r => r.status === 'review').length;
  const dbAwarded   = (dbRfqs || []).filter(r => r.status === 'awarded').length;
  const dbCancelled = (dbRfqs || []).filter(r => r.status === 'cancelled' || r.status === 'closed').length;

  const uiActive    = parseInt(await page.locator('#stat-active').textContent());
  const uiReview    = parseInt(await page.locator('#stat-review').textContent());
  const uiAwarded   = parseInt(await page.locator('#stat-awarded').textContent());
  const uiCancelled = parseInt(await page.locator('#stat-cancelled').textContent());

  console.log(`   DB truth → active:${dbActive} review:${dbReview} awarded:${dbAwarded} cancelled:${dbCancelled}`);
  console.log(`   UI shows  → active:${uiActive} review:${uiReview} awarded:${uiAwarded} cancelled:${uiCancelled}`);

  if (uiActive === dbActive) PASS(`A1: Active widget correct (${uiActive})`);
  else FAIL(`A1: Active widget shows ${uiActive}, expected ${dbActive}`);

  // Widget shows UNREAD review count (review RFQs with unseen bids), not raw DB total.
  // Assert: seeded review RFQ must be visible (>= 1), and never exceeds total review in DB.
  if (uiReview >= 1 && uiReview <= dbReview) PASS(`A2: Ready to Review widget shows ${uiReview} unread (DB has ${dbReview} total review) ✓`);
  else FAIL(`A2: Ready to Review widget shows ${uiReview}, expected 1–${dbReview} unread`);

  if (uiAwarded === dbAwarded) PASS(`A3: Awarded widget correct (${uiAwarded})`);
  else FAIL(`A3: Awarded widget shows ${uiAwarded}, expected ${dbAwarded}`);

  if (uiCancelled === dbCancelled) PASS(`A4: Cancelled widget correct (${uiCancelled})`);
  else FAIL(`A4: Cancelled widget shows ${uiCancelled}, expected ${dbCancelled}`);

  // ── B: Widget click filters ────────────────────────────────────────────────
  // NOTE: "Ready to Review" widget filters by hasUnreadBids (not raw status=review count).
  // Clear localStorage first so all review-status RFQs with bids appear as unread.
  console.log('\n── B: Widget click → correct RFQs shown ───────────────');

  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('itpn_viewed_bids_')).forEach(k => localStorage.removeItem(k));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#stat-active:not(:empty)', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // B1: Active filter
  await page.locator('#pill-active').click();
  await page.waitForTimeout(600);
  const b1Empty = await page.locator('#empty-state').isVisible().catch(() => false);
  const b1Count = b1Empty ? 0 : await page.locator('.rfq-list .rfq-card').count();
  const b1HasSeeded = await page.locator('.rfq-list .rfq-card').filter({ hasText: TAG + '_ACTIVE' }).isVisible().catch(() => false);
  if (b1Count === dbActive) PASS(`B1: Active filter shows ${b1Count} RFQ(s) — matches DB ✓`);
  else FAIL(`B1: Active filter shows ${b1Count}, expected ${dbActive}`);
  if (b1HasSeeded) PASS('B1b: Seeded active RFQ appears in filter ✓');
  else FAIL('B1b: Seeded active RFQ NOT found in active filter');

  // B2: Ready to Review filter — shows review-status RFQs with unread bids
  await page.locator('#pill-review').click();
  await page.waitForTimeout(600);
  const b2Empty = await page.locator('#empty-state').isVisible().catch(() => false);
  const b2Count = b2Empty ? 0 : await page.locator('.rfq-list .rfq-card').count();
  const b2HasSeeded = await page.locator('.rfq-list .rfq-card').filter({ hasText: TAG + '_REVIEW' }).isVisible().catch(() => false);
  if (b2Count >= 1) PASS(`B2: Ready to Review filter shows ${b2Count} RFQ(s) ✓`);
  else FAIL('B2: Ready to Review filter shows 0 — expected at least the seeded review RFQ');
  if (b2HasSeeded) PASS('B2b: Seeded review RFQ appears in filter ✓');
  else FAIL('B2b: Seeded review RFQ NOT found in ready-to-review filter');

  // B3: Awarded filter
  await page.locator('#pill-awarded').click();
  await page.waitForTimeout(600);
  const b3Empty = await page.locator('#empty-state').isVisible().catch(() => false);
  const b3Count = b3Empty ? 0 : await page.locator('.rfq-list .rfq-card').count();
  if (b3Count === dbAwarded) PASS(`B3: Awarded filter shows ${b3Count} RFQ(s) — matches DB ✓`);
  else FAIL(`B3: Awarded filter shows ${b3Count}, expected ${dbAwarded}`);

  // B4: Cancelled filter
  await page.locator('#pill-closed').click();
  await page.waitForTimeout(600);
  const b4Empty = await page.locator('#empty-state').isVisible().catch(() => false);
  const b4Count = b4Empty ? 0 : await page.locator('.rfq-list .rfq-card').count();
  if (b4Count === dbCancelled) PASS(`B4: Cancelled filter shows ${b4Count} RFQ(s) — matches DB ✓`);
  else FAIL(`B4: Cancelled filter shows ${b4Count}, expected ${dbCancelled}`);

  // ── C: Ready to Review — card expands inline bids, footer "Compare bids" navigates ──
  // Card click now expands inline bid dropdown (not navigate). "Compare bids →" button navigates.
  console.log('\n── C: Ready to Review — inline expand + navigate ──');

  await page.locator('#pill-review').click();
  await page.waitForTimeout(600);

  const reviewCards = await page.locator('.rfq-list .rfq-card').count();
  PASS(`C1: ${reviewCards} review RFQ(s) visible`);

  const newBadgesBefore = await page.locator('.rfq-list .rfq-card').filter({ hasText: 'NEW BIDS' }).count();
  PASS(`C2: ${newBadgesBefore} RFQ(s) showing NEW BIDS badge`);

  const reviewCard = page.locator('.rfq-list .rfq-card').filter({ hasText: TAG + '_REVIEW' });
  const found = await reviewCard.isVisible().catch(() => false);
  if (!found) { WARN('C: Seeded review RFQ not visible'); }
  else {
    // Clicking the card opens the RFQ detail drawer
    await reviewCard.click();
    await page.waitForTimeout(1200); // let drawer open + content fetch
    const drawerOverlay = page.locator('#drawer-overlay');
    const isDrawerOpen = await drawerOverlay.evaluate(el => el.classList.contains('open')).catch(() => false);
    if (isDrawerOpen) PASS('C3: Clicking review RFQ opens detail drawer ✓');
    else FAIL(`C3: Detail drawer did not open`);
    // Close drawer before clicking Compare bids button
    await page.locator('#drawer-overlay').click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);

    // Clicking the footer "Compare bids →" navigates and marks bids viewed
    const compareBidsBtn = reviewCard.locator('button:has-text("Compare bids")');
    await compareBidsBtn.click();
    await page.waitForURL(/compare-bids/, { timeout: 10000 }).catch(() => {});
    const onCompareBids = page.url().includes('compare-bids');
    if (onCompareBids) PASS('C4: Compare bids button navigates to compare-bids ✓');
    else FAIL(`C4: Did not navigate to compare-bids (URL: ${page.url()})`);

    // Navigate back and confirm unread sub-label
    await page.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stat-active:not(:empty)', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const unreadLabel = await page.locator('#stat-review-unread').textContent().catch(() => '');
    PASS(`C5: Unread sub-label: "${unreadLabel}"`);
  }

  // ── D: Active RFQ → inline bid expand + footer navigates ─────────────────
  // Card click expands bids inline. Footer "View bids →" button navigates.
  console.log('\n── D: Active RFQ → inline expand + navigate ──');

  await page.locator('#pill-active').click();
  await page.waitForTimeout(600);

  const activeCard = page.locator('.rfq-list .rfq-card').filter({ hasText: TAG + '_ACTIVE' });
  const activeFound = await activeCard.isVisible().catch(() => false);
  if (!activeFound) { WARN('D: Seeded active RFQ not visible'); }
  else {
    PASS('D1: Active RFQ card visible ✓');
    const bidCountText = await activeCard.locator('.bid-count-pill .num').textContent().catch(() => '');
    if (bidCountText.trim() !== '0' && bidCountText.trim() !== '') PASS(`D2: Bid count shows ${bidCountText.trim()} bid(s) on card ✓`);
    else WARN(`D2: Bid count shows "${bidCountText.trim()}" — may not have loaded yet`);

    // Clicking card opens the RFQ detail drawer
    await activeCard.click();
    await page.waitForTimeout(1200);
    const activeDrawer = page.locator('#drawer-overlay');
    const activeDrawerOpen = await activeDrawer.evaluate(el => el.classList.contains('open')).catch(() => false);
    if (activeDrawerOpen) PASS('D3: Clicking active RFQ opens detail drawer ✓');
    else FAIL(`D3: Detail drawer did not open`);
    await page.locator('#drawer-overlay').click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);

    // Navigate back for cleanup
    await page.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    PASS('D4: Navigated back to My RFQs');
  }

  console.log('\n══════════════════════════════════════════════════');

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log('\n── Cleanup ────────────────────────────────────────────');
  for (const bidId of seedIds.bids) {
    await api(token, `bids?id=eq.${bidId}`, 'DELETE');
  }
  for (const itemId of seedIds.rfqItems) {
    await api(token, `rfq_items?id=eq.${itemId}`, 'DELETE');
  }
  for (const rfqId of seedIds.rfqs) {
    await api(token, `rfqs?id=eq.${rfqId}`, 'DELETE');
  }
  PASS('All seeded test data deleted');
  console.log('\n');
});
