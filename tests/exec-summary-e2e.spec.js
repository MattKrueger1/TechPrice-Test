const { test, expect } = require('@playwright/test');

const BASE        = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

const BUYER_EMAIL    = 'mattkrueger@comcast.net';
const BUYER_PASSWORD = 'Test12345678';
const RESELLER_EMAIL    = 'mk@comcast.net';
const RESELLER_PASSWORD = 'Test12345678';

const RFQ_TITLE = 'EXEC_SUMMARY_TEST_' + Date.now();
let createdRfqId = null;
let buyerToken   = null;
let resellerToken = null;

const ANON_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

function authHeaders(token) {
  return { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
}

async function getToken(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
    if (!key) return null;
    try { return JSON.parse(localStorage.getItem(key))?.access_token; } catch { return null; }
  });
}

/** Delete all stale EXEC_SUMMARY_TEST_ RFQs left over from previous failed runs */
async function cleanupStale(token) {
  const h = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  // PostgREST: % must be percent-encoded as %25 in URL
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rfqs?title=like.EXEC_SUMMARY_TEST_%25&select=id`, { headers: h });
  const rows = await resp.json().catch(() => []);
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const id = row.id;
    await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${id}`, { method: 'DELETE', headers: authHeaders(resellerToken || token) });
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${id}`, { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/rest/v1/messages?rfq_id=eq.${id}`, { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${id}`, { method: 'DELETE', headers: authHeaders(resellerToken || token) });
    await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${id}`, { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${id}`, { method: 'DELETE', headers: h });
    console.log('🧹 Cleaned up stale test RFQ:', id);
  }
}

async function cleanup() {
  if (!createdRfqId) return;
  const bh = resellerToken ? authHeaders(resellerToken) : ANON_HEADERS;
  const bh2 = buyerToken ? authHeaders(buyerToken) : ANON_HEADERS;
  await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh });
  await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh2 });
  await fetch(`${SUPABASE_URL}/rest/v1/messages?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh2 });
  await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh });
  await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh2 });
  await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh2 });
  console.log('🧹 Cleaned up test RFQ:', createdRfqId);
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`);
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard|reseller/, { timeout: 15000 });
}

test('Exec Summary E2E — RFQ receives multiple bids, buyer awards winner, views one-pager', async ({ browser }) => {
  test.setTimeout(300000);

  const buyerCtx    = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer       = await buyerCtx.newPage();
  const reseller    = await resellerCtx.newPage();

  try {
    /* ── LOGIN ── */
    await loginAs(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);
    buyerToken    = await getToken(buyer);
    resellerToken = await getToken(reseller);
    console.log('✅ Both users logged in');

    /* Clean up any stale test RFQs from previous failed runs */
    if (buyerToken) await cleanupStale(buyerToken);

    /* ── STEP 1: Buyer posts RFQ ── */
    await buyer.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
    await buyer.waitForSelector('#project-title', { timeout: 10000 });
    await buyer.fill('#project-title', RFQ_TITLE);
    await buyer.fill('#project-desc', 'Executive summary end-to-end test — please ignore');
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14);
    await buyer.fill('#project-deadline', deadline.toISOString().slice(0, 10));
    await buyer.fill('#project-city', 'Dallas');
    await buyer.selectOption('#project-state', 'TX');
    await buyer.locator('#section-1 button.btn-next').click();

    await buyer.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await buyer.selectOption('#vendor-name-1', 'Cisco');
    await buyer.fill('#sku-part-1-1', 'C9300-48P-A');
    await buyer.fill('#sku-qty-1-1', '10');
    await buyer.locator('#section-2 button.btn-next').click();
    await buyer.waitForTimeout(800);
    await buyer.locator('#section-3 button.btn-next').click();

    await buyer.waitForSelector('#submit-btn', { timeout: 10000 });
    await buyer.click('#submit-btn');
    await expect(buyer.locator('.success-screen')).toBeVisible({ timeout: 20000 });
    console.log('✅ Step 1: RFQ posted —', RFQ_TITLE);

    /* ── STEP 2: Reseller finds the RFQ and submits a bid ── */
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await reseller.waitForSelector('#nav-browse', { timeout: 15000 });
    await reseller.waitForTimeout(5000);
    await reseller.click('#nav-browse');
    await reseller.waitForTimeout(2000);
    await reseller.waitForSelector('#open-rfq-grid .rfq-card', { timeout: 20000 });

    // Find the card for THIS test run using the exact unique title
    const cards = reseller.locator('#open-rfq-grid .rfq-card');
    let testCard = null;
    for (let i = 0; i < await cards.count(); i++) {
      const txt = await cards.nth(i).textContent();
      if (txt.includes(RFQ_TITLE)) { testCard = cards.nth(i); break; }
    }
    expect(testCard).not.toBeNull();

    // Open the bid modal
    await testCard.click();
    await reseller.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
    // Wait for price inputs to render (openBidForm is async — must fetch rfq_items first)
    await reseller.waitForSelector('#price-0', { timeout: 15000 });
    await reseller.waitForTimeout(500);

    // Fill in unit price and submit
    await reseller.fill('#price-0', '850'); // $8,500 total (850 × 10)
    await reseller.locator('#bid-submit-btn').click();
    // Wait for success state confirming bid was saved
    await reseller.waitForSelector('.bid-success', { timeout: 15000 });
    console.log('✅ Step 2: Reseller submitted bid at $850/unit ($8,500 total)');

    /* ── STEP 3: Buyer navigates to My RFQs, finds the test RFQ ── */
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForTimeout(4000);

    // Find the card with our exact RFQ title and get its rfq_id
    const rfqCards = buyer.locator('.rfq-card');
    let rfqCard = null;
    for (let i = 0; i < await rfqCards.count(); i++) {
      const txt = await rfqCards.nth(i).textContent();
      if (txt.includes(RFQ_TITLE)) { rfqCard = rfqCards.nth(i); break; }
    }
    expect(rfqCard).not.toBeNull();
    console.log('✅ Step 3: Buyer found test RFQ card');

    // Click "View bids" to go to compare-bids
    const viewBidsBtn = rfqCard.locator('button, a').filter({ hasText: /view bids|compare/i }).first();
    if (await viewBidsBtn.count() > 0) {
      await viewBidsBtn.click();
    } else {
      await rfqCard.click();
    }
    await buyer.waitForURL(/compare-bids/, { timeout: 10000 });

    // Capture RFQ id from URL
    const cbUrl = buyer.url();
    const urlMatch = cbUrl.match(/rfq=([a-f0-9-]+)/);
    if (urlMatch) createdRfqId = urlMatch[1];
    console.log('✅ Step 3: Compare bids page — RFQ ID:', createdRfqId);

    /* ── STEP 4: Insert 2 more synthetic bids via API to simulate market competition ── */
    if (createdRfqId && resellerToken) {
      // Bid 2: $9,500 (higher) — use anon key since RLS blocks anon inserts, so use reseller token
      await fetch(`${SUPABASE_URL}/rest/v1/bids`, {
        method: 'POST',
        headers: { ...authHeaders(resellerToken), 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          rfq_id: createdRfqId,
          reseller_id: (await reseller.evaluate(() => {
            const k = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
            return k ? JSON.parse(localStorage.getItem(k))?.user?.id : null;
          })),
          total_price: 9500,
          status: 'pending',
          notes: 'Synthetic test bid — high price',
        }),
      });
      // Bid 3: $7,200 (lower — best price)
      await fetch(`${SUPABASE_URL}/rest/v1/bids`, {
        method: 'POST',
        headers: { ...authHeaders(resellerToken), 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          rfq_id: createdRfqId,
          reseller_id: (await reseller.evaluate(() => {
            const k = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
            return k ? JSON.parse(localStorage.getItem(k))?.user?.id : null;
          })),
          total_price: 7200,
          status: 'pending',
          notes: 'Synthetic test bid — best price',
        }),
      });
      console.log('✅ Step 4: Attempted 2 additional synthetic bids ($9,500 and $7,200)');
    }

    /* ── STEP 5: Buyer awards a bid ── */
    // Navigate fresh to compare-bids with the known rfq id
    await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${createdRfqId}`);
    // Wait for bid cards to render before looking for award button
    await buyer.waitForSelector('#bids-grid .bid-card', { timeout: 25000 });
    await buyer.waitForTimeout(1000);

    // Click first award button
    const awardBtn = buyer.locator('.btn-award:not(.awarded), .btn-award-sm:not(.awarded)').first();
    await expect(awardBtn).toBeVisible({ timeout: 10000 });
    await awardBtn.click();
    await buyer.waitForTimeout(500);

    // Confirm in modal
    const overlay = buyer.locator('#award-overlay');
    await expect(overlay).toHaveClass(/open/, { timeout: 5000 });
    console.log('✅ Step 5: Award modal open');

    await buyer.locator('#btn-confirm-award').click();
    await buyer.waitForTimeout(4000);
    console.log('✅ Step 5: Award confirmed');

    // Check for intro overlay or awarded state
    const introOverlay = buyer.locator('#intro-overlay');
    if (await introOverlay.isVisible()) {
      console.log('✅ Step 5: Post-award intro overlay shown');

      // Check exec summary link is present in intro
      const summaryLink = buyer.locator('#intro-overlay a[href*="exec-summary"]');
      await expect(summaryLink).toBeVisible({ timeout: 5000 });
      console.log('✅ Step 5: Executive Summary link visible in intro overlay');
    }

    /* ── STEP 6: Buyer opens Executive Summary ── */
    const summaryUrl = `${BASE}/bidbridge-exec-summary.html?rfq=${createdRfqId}`;
    await buyer.goto(summaryUrl);
    await buyer.waitForTimeout(5000);
    console.log('✅ Step 6: Navigated to exec summary page');

    // Verify key sections are present
    const bodyText = await buyer.locator('body').textContent();
    expect(bodyText).toMatch(/Executive Summary|Procurement Report/i);
    expect(bodyText).toMatch(/Days on market/i);
    expect(bodyText).toMatch(/Bids received/i);
    expect(bodyText).toMatch(/Highest bid/i);
    expect(bodyText).toMatch(/Average bid/i);
    expect(bodyText).toMatch(/Awarded price/i);
    expect(bodyText).toMatch(/Your savings/i);
    expect(bodyText).toMatch(/IT Pricing Network/i);
    console.log('✅ Step 6: All expected sections present in executive summary');

    // Verify the bid count shows at least 1 bid
    const bidCountMatch = bodyText.match(/(\d+)\s*bid/i);
    if (bidCountMatch) {
      const count = parseInt(bidCountMatch[1]);
      expect(count).toBeGreaterThan(0);
      console.log(`✅ Step 6: Summary shows ${count} bid(s) received`);
    }

    // Verify dollar values are showing
    const dollarValues = bodyText.match(/\$[\d,]+\.\d{2}/g) || [];
    expect(dollarValues.length).toBeGreaterThan(2);
    console.log(`✅ Step 6: ${dollarValues.length} dollar values present: ${dollarValues.slice(0, 5).join(', ')}`);

    // Verify print button is there
    await expect(buyer.locator('.btn-print')).toBeVisible();
    console.log('✅ Step 6: Print/Save as PDF button visible');

    // Verify thank-you paragraph mentions the buyer
    expect(bodyText).toMatch(/thank you|trusting/i);
    console.log('✅ Step 6: Thank-you paragraph present');

    console.log('\n🎉 Full Executive Summary E2E test passed!');
    console.log('   RFQ posted → bids received → winner awarded → one-pager generated ✓');

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
    await cleanup();
  }
});
