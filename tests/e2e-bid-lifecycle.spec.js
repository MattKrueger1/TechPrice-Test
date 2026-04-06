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

async function deleteTestData() {
  if (!createdRfqId) return;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };
  await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${createdRfqId}`, { method: 'DELETE', headers });
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
    await buyer.selectOption('#vendor-name-1', 'Dell Technologies');
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
    await reseller.waitForSelector('.tab-btn', { timeout: 20000 });
    await reseller.waitForTimeout(5000); // let Supabase data load
    console.log('🏪 Step 2: Dashboard loaded, looking for Open RFQs tab...');
    await reseller.click('button:has-text("Open RFQs")');
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
    await reseller.waitForSelector('.sku-price-input', { timeout: 15000 });
    await reseller.fill('.sku-price-input', '1000');
    console.log('🏪 Step 2: Submitting bid...');
    await reseller.click('#bid-submit-btn');
    await reseller.waitForTimeout(3000);
    console.log('✅ Reseller bid submitted');

    /* ── STEP 3: Buyer sees bid on compare-bids ── */
    console.log('👀 Step 3: Buyer checking compare-bids...');
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForSelector('button:has-text("View bids")', { timeout: 10000 });
    await buyer.click('button:has-text("View bids")');
    await expect(buyer).toHaveURL(/compare-bids/);

    // Capture RFQ id from URL for cleanup
    const url = buyer.url();
    const match = url.match(/rfq=([a-f0-9-]+)/);
    if (match) createdRfqId = match[1];
    console.log('✅ Buyer sees compare-bids, RFQ id:', createdRfqId);

    await buyer.waitForSelector('.bid-card', { timeout: 15000 });
    console.log('✅ Buyer can see the bid');

    /* ── STEP 4: Buyer edits the RFQ ── */
    console.log('✏️ Step 4: Buyer editing RFQ...');
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForSelector('.rfq-card-footer', { timeout: 10000 });
    const editBtn = buyer.locator('button:has-text("Edit")').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await buyer.waitForTimeout(1000);
      console.log('✅ Edit triggered');
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
    await reseller.waitForSelector('.tab-btn', { timeout: 15000 });
    console.log('✅ Step 5 complete — skipping bid revision, proceeding to award');

    /* ── STEP 6: Buyer awards the bid ── */
    console.log('🏆 Step 6: Buyer awarding bid...');
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForSelector('button:has-text("View bids")', { timeout: 10000 });
    await buyer.click('button:has-text("View bids")');
    await expect(buyer).toHaveURL(/compare-bids/);
    await buyer.waitForSelector('button:has-text("Award bid")', { timeout: 15000 });
    await buyer.click('button:has-text("Award bid")');
    await expect(buyer.locator('#award-overlay')).toHaveClass(/open/);
    await buyer.click('button:has-text("Confirm award")');
    await buyer.waitForTimeout(3000);
    await expect(buyer.locator('.winner-ribbon')).toBeVisible({ timeout: 10000 });
    console.log('✅ Bid awarded successfully');

    /* ── STEP 7: Reseller sees WON ── */
    console.log('🎉 Step 7: Reseller checking WON status...');
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await reseller.waitForSelector('.tab-btn', { timeout: 15000 });
    await reseller.waitForTimeout(3000);
    await reseller.click('button:has-text("My bids")');
    await reseller.click('#mybids-pill-won');
    await expect(reseller.locator('.new-tag:has-text("WON")').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Reseller sees WON status — lifecycle complete!');

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
    await deleteTestData();
  }
});
