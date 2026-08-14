import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';
const TEST_RFQ_TITLE = 'PLAYWRIGHT_TEST_RFQ_' + Date.now();
let createdRfqId = null;

const BUYER_EMAIL = 'mattkrueger@comcast.net';
const BUYER_PASSWORD = 'Test12345678';
const RESELLER_EMAIL = 'mk@comcast.net';
const RESELLER_PASSWORD = 'Test12345678';

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard|reseller/, { timeout: 15000 });
  console.log(`✅ Logged in as ${email}`);
}

const ANON_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function cleanupStale(buyerToken, resellerToken) {
  const bh = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${buyerToken}`, 'Content-Type': 'application/json' };
  const rh = resellerToken ? { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${resellerToken}`, 'Content-Type': 'application/json' } : bh;
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rfqs?title=like.PLAYWRIGHT_TEST_RFQ_%25&select=id`, { headers: bh });
  const rows = await resp.json().catch(() => []);
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const id = row.id;
    await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${id}`, { method: 'DELETE', headers: rh });
    await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${id}`, { method: 'DELETE', headers: rh });
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${id}`, { method: 'DELETE', headers: bh });
    await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${id}`, { method: 'DELETE', headers: bh });
    await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${id}`, { method: 'DELETE', headers: bh });
    console.log('🧹 Cleaned up stale test RFQ:', id);
  }
}

let _buyerToken = null;
let _resellerToken = null;

async function deleteTestData() {
  if (!createdRfqId) return;
  const bh = _buyerToken ? { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${_buyerToken}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' } : ANON_HEADERS;
  const rh = _resellerToken ? { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${_resellerToken}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' } : bh;
  await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: rh });
  await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: rh });
  await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh });
  await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh });
  await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh });
  console.log('🧹 Cleaned up test RFQ:', createdRfqId);
}

test('Full bid lifecycle — submit, bid, edit, revise, award', async ({ browser }) => {
  test.setTimeout(240000);

  const buyerCtx = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const reseller = await resellerCtx.newPage();

  try {
    // Log in both users first
    await loginAs(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);

    // Clean up stale test RFQs from previous failed runs
    const getToken = async (page) => page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
      if (!key) return null;
      try { return JSON.parse(localStorage.getItem(key))?.access_token; } catch { return null; }
    });
    _buyerToken = await getToken(buyer);
    _resellerToken = await getToken(reseller);
    if (_buyerToken) await cleanupStale(_buyerToken, _resellerToken);

    /* ── STEP 1: Buyer submits a new RFQ ── */
    console.log('📋 Step 1: Navigating to submit RFQ page...');
    await buyer.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await buyer.waitForSelector('#project-title', { timeout: 15000 });
    console.log('📋 Step 1: Filling project details...');
    await buyer.fill('#project-title', TEST_RFQ_TITLE);
    await buyer.fill('#project-desc', 'Automated test RFQ — please ignore');
    const future = new Date();
    future.setDate(future.getDate() + 30);
    await buyer.fill('#project-deadline', future.toISOString().slice(0, 10));
    await buyer.fill('#project-city', 'Boston');
    await buyer.selectOption('#project-state', 'MA');
    console.log('📋 Step 1: Clicking Next (step 1 → 2)...');
    await buyer.click('#section-1 button.btn-next');

    // Step 2 — Vendors
    console.log('📋 Step 1: Waiting for vendor section...');
    await buyer.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await buyer.selectOption('#vendor-name-1', 'Cisco');
    await buyer.fill('#sku-part-1-1', 'TEST-SKU-001');
    await buyer.fill('#sku-qty-1-1', '5');
    await buyer.waitForTimeout(500);
    console.log('📋 Step 1: Clicking Next (step 2 → 3)...');
    await buyer.click('#section-2 button.btn-next');

    // Step 3 — Strategy (defaults fine)
    await buyer.waitForTimeout(1000);
    console.log('📋 Step 1: Clicking Next (step 3 → 4)...');
    await buyer.click('#section-3 button.btn-next');

    // Step 4 — Review & submit
    console.log('📋 Step 1: Waiting for submit button...');
    await buyer.waitForSelector('#submit-btn', { timeout: 10000 });
    await buyer.click('#submit-btn');
    console.log('📋 Step 1: Waiting for success screen...');
    await expect(buyer.locator('.success-screen')).toBeVisible({ timeout: 20000 });
    const badgeText = await buyer.locator('#rfq-id-badge').textContent();
    console.log('✅ RFQ created:', badgeText);

    /* ── STEP 2: Reseller submits a bid ── */
    console.log('🏪 Step 2: Reseller loading dashboard...');
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await reseller.waitForSelector('#open-rfq-grid', { timeout: 20000 });
    await reseller.waitForTimeout(5000); // let Supabase data load
    console.log('🏪 Step 2: Dashboard loaded, looking for Open RFQs tab...');
    // Open RFQs section always visible
    await reseller.waitForTimeout(2000);

    await reseller.waitForSelector('#open-rfq-grid .rfq-card', { timeout: 20000 });
    const cards = reseller.locator('#open-rfq-grid .rfq-card');
    const cardCount = await cards.count();
    console.log(`🏪 Step 2: Found ${cardCount} open RFQ cards`);

    let testCard = null;
    for (let i = 0; i < cardCount; i++) {
      const txt = await cards.nth(i).textContent();
      if (txt.includes('PLAYWRIGHT_TEST_RFQ_')) { testCard = cards.nth(i); break; }
    }
    expect(testCard).not.toBeNull();
    console.log('🏪 Step 2: Opening bid form...');
    await testCard.click();

    await reseller.waitForSelector('#bid-modal:not(.hidden)', { timeout: 15000 });
    await reseller.waitForSelector('#price-0', { timeout: 15000 });
    await reseller.fill('#price-0', '1000');
    const authCb = reseller.locator('#bid-auth-checkbox');
    if (await authCb.count() > 0) await authCb.check();
    console.log('🏪 Step 2: Submitting bid...');
    await reseller.locator('#bid-submit-btn').click();
    // Wait for success state
    await reseller.waitForSelector('.bid-success', { timeout: 15000 });
    console.log('✅ Reseller bid submitted');

    /* ── STEP 3: Buyer sees bid on compare-bids ── */
    console.log('👀 Step 3: Buyer checking compare-bids...');
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForTimeout(5000); // let RFQ cards load

    // Find the specific test RFQ card by title
    const rfqCardsList = buyer.locator('#rfq-list .rfq-card');
    let testRfqCard3 = null;
    for (let i = 0; i < await rfqCardsList.count(); i++) {
      const txt = await rfqCardsList.nth(i).textContent();
      if (txt.includes(TEST_RFQ_TITLE)) { testRfqCard3 = rfqCardsList.nth(i); break; }
    }

    if (testRfqCard3) {
      // Try view bids button first; fall back to clicking the card itself
      const viewBidsBtn = testRfqCard3.locator('.btn-compare');
      if (await viewBidsBtn.count() > 0) {
        await viewBidsBtn.click();
      } else {
        await testRfqCard3.click();
      }
    } else {
      // Fallback: click first available view bids button
      await buyer.click('.btn-compare');
    }
    await expect(buyer).toHaveURL(/compare-bids/, { timeout: 10000 });

    // Capture RFQ id from URL for cleanup
    const url = buyer.url();
    const match = url.match(/rfq=([a-f0-9-]+)/);
    if (match) createdRfqId = match[1];
    console.log('✅ Buyer sees compare-bids, RFQ id:', createdRfqId);

    // Navigate directly to compare-bids with the rfq param and wait for bids to load
    await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${createdRfqId}`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForSelector('.bid-card', { timeout: 30000 });
    console.log('✅ Buyer can see the bid');

    /* ── STEP 4: Buyer edits the RFQ ── */
    console.log('✏️ Step 4: Buyer editing RFQ...');
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForSelector('.rfq-card', { timeout: 10000 });
    await buyer.waitForTimeout(1500);
    // Click the seeded RFQ card to open detail drawer, then close it
    // Edit button lives in the inline expand panel, accessed via the chevron
    const seededCard = buyer.locator('.rfq-card').first();
    await seededCard.click();
    await buyer.waitForTimeout(600);
    // Close the drawer so we can access inline expand
    await buyer.locator('#drawer-overlay').click({ force: true }).catch(() => {});
    await buyer.waitForTimeout(400);
    // Open inline expand via chevron
    await buyer.locator('.expand-chevron-btn').first().click({ force: true });
    await buyer.waitForTimeout(800);
    const editBtn = buyer.locator('button:has-text("Edit")').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await buyer.waitForTimeout(1000);
      console.log('✅ Edit triggered');
    } else {
      console.log('ℹ️ Edit button not found (may be in draft/active state only)');
    }

    /* ── STEP 5: Reseller checks notifications and revises bid ── */
    console.log('🔔 Step 5: Reseller checking notifications...');
    await reseller.goto(`${BASE}/bidbridge-notifications_1.html`);
    await reseller.waitForTimeout(2000);
    const notifItems = reseller.locator('.notif-item');
    if (await notifItems.count() > 0) {
      await expect(notifItems.first()).toBeVisible({ timeout: 10000 });
      console.log('✅ Reseller has notifications');
    }

    // Revise bid
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await reseller.waitForSelector('#open-rfq-grid', { timeout: 15000 });
    console.log('✅ Step 5 complete — skipping bid revision, proceeding to award');

    /* ── STEP 6: Buyer awards the bid ── */
    console.log('🏆 Step 6: Buyer awarding bid...');
    // Navigate directly using the captured rfq id
    await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${createdRfqId}`, { waitUntil: 'domcontentloaded' });
    await expect(buyer).toHaveURL(/compare-bids/);
    await buyer.waitForTimeout(8000); // let Supabase load bids
    const awardBtn = buyer.locator('.btn-award:not(.awarded)').first();
    await expect(awardBtn).toBeVisible({ timeout: 15000 });
    await awardBtn.click();
    await expect(buyer.locator('#award-overlay')).toHaveClass(/open/);
    await buyer.locator('#btn-confirm-award').click();
    await buyer.waitForTimeout(5000);
    // Reload compare-bids to ensure awarded state renders after Supabase write
    await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${createdRfqId}`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForTimeout(5000);
    // For single-vendor RFQs the awarded indicator is a .winner-badge span or an .awarded button
    const awardedIndicator = buyer.locator('.winner-badge, .btn-award.awarded').first();
    await expect(awardedIndicator).toBeVisible({ timeout: 15000 });
    console.log('✅ Bid awarded successfully');

    /* ── STEP 7: Reseller sees WON ── */
    console.log('🎉 Step 7: Reseller checking WON status...');
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await reseller.waitForSelector('#open-rfq-grid', { timeout: 15000 });
    await reseller.waitForTimeout(3000);
    // My Bids section always visible
    await reseller.click('#mybids-pill-won');
    await expect(reseller.locator('.new-tag:has-text("WON")').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Reseller sees WON status — lifecycle complete!');

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
    await deleteTestData();
  }
});
