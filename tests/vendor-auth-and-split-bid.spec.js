const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

const BUYER_EMAIL = 'mattkrueger@comcast.net';
const BUYER_PASSWORD = 'Test12345678';
const RESELLER_EMAIL = 'mk@comcast.net';
const RESELLER_PASSWORD = 'Test12345678';

const TS = Date.now();
const SPLIT_RFQ_TITLE = 'PLAYWRIGHT_SPLIT_RFQ_' + TS;
const SOLE_RFQ_TITLE = 'PLAYWRIGHT_SOLE_RFQ_' + TS;

let splitRfqId = null;
let soleRfqId = null;

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard|reseller/, { timeout: 15000 });
}

async function cleanupRfq(rfqId) {
  if (!rfqId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${rfqId}`, { method: 'DELETE', headers: HEADERS });
  await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${rfqId}`, { method: 'DELETE', headers: HEADERS });
  await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${rfqId}`, { method: 'DELETE', headers: HEADERS });
  await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${rfqId}`, { method: 'DELETE', headers: HEADERS });
}

async function submitRFQ(buyer, title, strategy, vendors) {
  // vendors = array of { vendorName, sku } e.g. [{vendorName:'Cisco',sku:'CIS-001'}]
  await buyer.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await buyer.waitForSelector('#project-title', { timeout: 15000 });
  await buyer.fill('#project-title', title);
  await buyer.fill('#project-desc', 'Playwright test RFQ — ignore');
  const future = new Date(); future.setDate(future.getDate() + 30);
  await buyer.fill('#project-deadline', future.toISOString().slice(0, 10));
  await buyer.fill('#project-city', 'Boston');
    await buyer.selectOption('#project-state', 'MA');
  await buyer.click('#section-1 button.btn-next');

  // Step 2 — Vendors
  await buyer.waitForSelector('#vendor-name-1', { timeout: 10000 });
  await buyer.selectOption('#vendor-name-1', vendors[0].vendorName);
  await buyer.fill('#sku-part-1-1', vendors[0].sku);
  await buyer.fill('#sku-qty-1-1', '3');

  // Add additional vendors if specified
  for (let i = 1; i < vendors.length; i++) {
    await buyer.click('button.btn-add-vendor');
    await buyer.waitForSelector(`#vendor-name-${i + 1}`, { timeout: 5000 });
    await buyer.selectOption(`#vendor-name-${i + 1}`, vendors[i].vendorName);
    await buyer.fill(`#sku-part-${i + 1}-1`, vendors[i].sku);
    await buyer.fill(`#sku-qty-${i + 1}-1`, '2');
  }

  await buyer.waitForTimeout(500);
  await buyer.click('#section-2 button.btn-next');

  // Step 3 — Strategy
  await buyer.waitForTimeout(800);
  if (strategy === 'split' && vendors.length > 1) {
    await buyer.click('#card-split');
    await buyer.waitForTimeout(300);
  }
  await buyer.click('#section-3 button.btn-next');

  // Step 4 — Submit
  await buyer.waitForSelector('#submit-btn', { timeout: 10000 });
  await buyer.click('#submit-btn');
  await expect(buyer.locator('.success-screen')).toBeVisible({ timeout: 20000 });
  const badgeText = await buyer.locator('#rfq-id-badge').textContent();
  const idHex = badgeText.replace('RFQ ', '').toLowerCase();
  return idHex;
}

/* ══════════════════════════════════════════════════════════
   TEST 1: Vendor authorization filtering — reseller only
   sees RFQs for vendors they're authorized to sell
══════════════════════════════════════════════════════════ */
test('Reseller only sees RFQs matching their authorized vendors', async ({ browser }) => {
  test.setTimeout(120000);
  const buyerCtx = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const reseller = await resellerCtx.newPage();

  try {
    await loginAs(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);

    // First, find out what vendors the reseller is authorized for
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForSelector('.tab-btn', { timeout: 20000 });
    await reseller.waitForTimeout(4000); // let data load

    // Capture authorized vendors from sidebar
    const tierRows = reseller.locator('.profile-tier-row');
    const tierCount = await tierRows.count();
    console.log(`✅ Reseller has ${tierCount} authorized vendor(s)`);

    // Get all vendor names shown in the authorized list
    const authorizedVendors = [];
    for (let i = 0; i < tierCount; i++) {
      const vName = await tierRows.nth(i).locator('.profile-tier-vendor').textContent();
      authorizedVendors.push(vName.trim());
    }
    console.log('✅ Authorized vendors:', authorizedVendors);

    // Check the Open RFQs tab — every card should only be for authorized vendors
    await reseller.click('button:has-text("Open RFQs")');
    await reseller.waitForTimeout(2000);
    const cards = reseller.locator('#open-rfq-grid .rfq-card');
    const cardCount = await cards.count();
    console.log(`✅ Reseller sees ${cardCount} open RFQ card(s)`);

    for (let i = 0; i < cardCount; i++) {
      const cardText = await cards.nth(i).textContent();
      // Every card should mention at least one authorized vendor
      const hasAuthorizedVendor = authorizedVendors.some(v => cardText.includes(v));
      expect(hasAuthorizedVendor, `Card ${i + 1} contains unauthorized vendor. Card text: ${cardText.substring(0, 100)}`).toBe(true);
    }
    console.log('✅ All visible RFQs are for authorized vendors only');

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
  }
});

/* ══════════════════════════════════════════════════════════
   TEST 2: Tier enforcement — reseller below required tier
   should NOT see a gold-tier-required RFQ
══════════════════════════════════════════════════════════ */
test('Tier enforcement — reseller below required tier cannot see RFQ', async ({ browser }) => {
  test.setTimeout(120000);
  const buyerCtx = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const reseller = await resellerCtx.newPage();

  try {
    await loginAs(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);

    // Check reseller's tier for Dell (or their first vendor)
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForSelector('.tab-btn', { timeout: 20000 });
    await reseller.waitForTimeout(4000);

    // Get reseller's first authorized vendor and its tier
    const firstVendorRow = reseller.locator('.profile-tier-row').first();
    const vendorName = (await firstVendorRow.locator('.profile-tier-vendor').textContent()).trim();
    const tierChip = await firstVendorRow.locator('.tier-chip').textContent();
    const resellerTier = tierChip.toLowerCase();
    console.log(`✅ Reseller is ${resellerTier} for ${vendorName}`);

    // Submit a RFQ requiring Platinum tier (highest) for the vendor the reseller sells
    // If the reseller is not Platinum, they should NOT see this RFQ
    const rfqTitle = 'PLAYWRIGHT_TIER_TEST_' + TS;
    await buyer.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForSelector('#project-title', { timeout: 15000 });
    await buyer.fill('#project-title', rfqTitle);
    await buyer.fill('#project-desc', 'Tier enforcement test — ignore');
    const future = new Date(); future.setDate(future.getDate() + 30);
    await buyer.fill('#project-deadline', future.toISOString().slice(0, 10));
    await buyer.fill('#project-city', 'Boston');
    await buyer.selectOption('#project-state', 'MA');
    await buyer.click('#section-1 button.btn-next');

    await buyer.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await buyer.selectOption('#vendor-name-1', vendorName);
    await buyer.fill('#sku-part-1-1', 'TIER-TEST-001');
    await buyer.fill('#sku-qty-1-1', '1');
    await buyer.waitForTimeout(500);
    await buyer.click('#section-2 button.btn-next');

    // Step 3 — select Platinum tier requirement
    await buyer.waitForTimeout(800);
    const platinumOption = buyer.locator('.tier-option:has-text("Platinum")').first();
    if (await platinumOption.count() > 0) {
      await platinumOption.click();
      console.log('✅ Buyer set Platinum tier requirement');
    }
    await buyer.click('#section-3 button.btn-next');
    await buyer.waitForSelector('#submit-btn', { timeout: 10000 });
    await buyer.click('#submit-btn');
    await expect(buyer.locator('.success-screen')).toBeVisible({ timeout: 20000 });
    const badge = await buyer.locator('#rfq-id-badge').textContent();
    const tierRfqId = badge.replace('RFQ ', '').toLowerCase();
    // Convert short hex to full UUID pattern for cleanup - just search by title
    console.log('✅ Buyer submitted Platinum-tier-required RFQ:', badge);

    // Give Supabase a moment
    await buyer.waitForTimeout(2000);

    // Reload reseller dashboard and check if Platinum RFQ is visible
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForSelector('.tab-btn', { timeout: 20000 });
    await reseller.waitForTimeout(5000);
    await reseller.click('button:has-text("Open RFQs")');
    await reseller.waitForTimeout(2000);

    const cards = reseller.locator('#open-rfq-grid .rfq-card');
    const cardCount = await cards.count();
    let tierRfqVisible = false;
    for (let i = 0; i < cardCount; i++) {
      const txt = await cards.nth(i).textContent();
      if (txt.includes('PLAYWRIGHT_TIER_TEST_')) { tierRfqVisible = true; break; }
    }

    if (resellerTier.includes('platinum')) {
      // If reseller IS platinum, they should see it
      console.log('ℹ️  Reseller is Platinum — they should see the RFQ');
      expect(tierRfqVisible).toBe(true);
    } else {
      // Reseller is below Platinum — should NOT see it
      console.log(`✅ Tier enforcement works — ${resellerTier} reseller does not see Platinum-required RFQ`);
      expect(tierRfqVisible).toBe(false);
    }

    // Cleanup
    await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${tierRfqId}`, { method: 'DELETE', headers: HEADERS });
    await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${tierRfqId}`, { method: 'DELETE', headers: HEADERS });

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
  }
});

/* ══════════════════════════════════════════════════════════
   TEST 3: Split-bid RFQ — reseller bid form only shows
   vendors they're authorized to sell
══════════════════════════════════════════════════════════ */
test('Split-bid — reseller bid form only shows authorized vendor line items', async ({ browser }) => {
  test.setTimeout(180000);
  const buyerCtx = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const reseller = await resellerCtx.newPage();

  try {
    await loginAs(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);

    // Find out reseller's authorized vendor(s)
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForSelector('.tab-btn', { timeout: 20000 });
    await reseller.waitForTimeout(4000);
    const tierRows = reseller.locator('.profile-tier-row');
    const authorizedVendors = [];
    const count = await tierRows.count();
    for (let i = 0; i < count; i++) {
      const v = (await tierRows.nth(i).locator('.profile-tier-vendor').textContent()).trim();
      authorizedVendors.push(v);
    }
    console.log('✅ Reseller authorized vendors:', authorizedVendors);

    // Buyer creates a split-bid RFQ with 2 vendors:
    // one the reseller IS authorized for, one they are NOT
    const resellerVendor = authorizedVendors[0];
    // Pick a vendor the reseller doesn't sell (use Fortinet if not in their list, else Nutanix)
    const otherVendors = ['Fortinet', 'Nutanix', 'Arista Networks', 'F5 Networks'].filter(v => !authorizedVendors.includes(v));
    const unauthorizedVendor = otherVendors[0];
    console.log(`✅ Using ${resellerVendor} (authorized) + ${unauthorizedVendor} (not authorized)`);

    // Submit split-bid RFQ
    await buyer.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForSelector('#project-title', { timeout: 15000 });
    await buyer.fill('#project-title', SPLIT_RFQ_TITLE);
    await buyer.fill('#project-desc', 'Split bid test — ignore');
    const future = new Date(); future.setDate(future.getDate() + 30);
    await buyer.fill('#project-deadline', future.toISOString().slice(0, 10));
    await buyer.fill('#project-city', 'Boston');
    await buyer.selectOption('#project-state', 'MA');
    await buyer.click('#section-1 button.btn-next');

    await buyer.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await buyer.selectOption('#vendor-name-1', resellerVendor);
    await buyer.fill('#sku-part-1-1', 'AUTH-SKU-001');
    await buyer.fill('#sku-qty-1-1', '2');

    // Add second vendor
    await buyer.click('button.btn-add-vendor');
    await buyer.waitForSelector('#vendor-name-2', { timeout: 5000 });
    await buyer.selectOption('#vendor-name-2', unauthorizedVendor);
    await buyer.fill('#sku-part-2-1', 'UNAUTH-SKU-001');
    await buyer.fill('#sku-qty-2-1', '1');
    await buyer.waitForTimeout(500);
    await buyer.click('#section-2 button.btn-next');

    // Step 3 — select Split strategy
    await buyer.waitForTimeout(1000);
    await buyer.click('#card-split');
    await buyer.waitForTimeout(300);
    await buyer.click('#section-3 button.btn-next');

    await buyer.waitForSelector('#submit-btn', { timeout: 10000 });
    await buyer.click('#submit-btn');
    await expect(buyer.locator('.success-screen')).toBeVisible({ timeout: 20000 });
    const badge = await buyer.locator('#rfq-id-badge').textContent();
    console.log('✅ Split bid RFQ created:', badge);

    await buyer.waitForTimeout(3000);

    // Reseller goes to their dashboard and finds the split RFQ
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForSelector('.tab-btn', { timeout: 20000 });
    await reseller.waitForTimeout(5000);
    await reseller.click('button:has-text("Open RFQs")');
    await reseller.waitForTimeout(2000);

    await reseller.waitForSelector('#open-rfq-grid .rfq-card', { timeout: 15000 });
    const cards = reseller.locator('#open-rfq-grid .rfq-card');
    const cardCount = await cards.count();

    let splitCard = null;
    for (let i = 0; i < cardCount; i++) {
      const txt = await cards.nth(i).textContent();
      if (txt.includes('PLAYWRIGHT_SPLIT_RFQ_')) { splitCard = cards.nth(i); break; }
    }
    expect(splitCard, 'Reseller should see the split RFQ (they are authorized for one vendor)').not.toBeNull();
    console.log('✅ Reseller can see the split-bid RFQ');

    // Open the bid form
    await splitCard.click();
    await reseller.waitForSelector('#bid-modal:not(.hidden)', { timeout: 15000 });
    await reseller.waitForTimeout(1000);

    // The bid form should ONLY show line items for the reseller's authorized vendor
    // It should NOT show the unauthorized vendor's SKUs
    const modalBody = await reseller.locator('#bid-modal-body').textContent();
    console.log('✅ Bid form loaded — checking vendor filtering');

    expect(modalBody).toContain(resellerVendor);
    expect(modalBody).not.toContain(unauthorizedVendor);
    console.log(`✅ Split-bid form shows ${resellerVendor} items only — ${unauthorizedVendor} filtered out`);

    // Capture RFQ ID from URL if possible — otherwise cleanup by title
    const url = reseller.url();
    const match = url.match(/rfq=([a-f0-9-]+)/);
    if (match) splitRfqId = match[1];

    await reseller.click('.btn-cancel-bid');

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
    if (splitRfqId) await cleanupRfq(splitRfqId);
    // Try to clean up by title if we didn't get the ID
    else {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rfqs?title=eq.${encodeURIComponent(SPLIT_RFQ_TITLE)}&select=id`, { headers: { ...HEADERS, 'Prefer': 'return=representation' } });
      const rows = await res.json();
      for (const row of rows || []) await cleanupRfq(row.id);
    }
  }
});

/* ══════════════════════════════════════════════════════════
   TEST 4: Full split-bid lifecycle — buyer submits split RFQ,
   reseller bids on their portion, buyer awards per-vendor,
   reseller sees WON
══════════════════════════════════════════════════════════ */
test('Full split-bid lifecycle — per-vendor award flow', async ({ browser }) => {
  test.setTimeout(240000);
  const buyerCtx = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const reseller = await resellerCtx.newPage();
  let rfqId = null;

  try {
    await loginAs(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);

    // Find reseller's authorized vendor
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForSelector('.tab-btn', { timeout: 20000 });
    await reseller.waitForTimeout(4000);
    const firstVendorEl = reseller.locator('.profile-tier-vendor').first();
    const resellerVendor = (await firstVendorEl.textContent()).trim();
    console.log('✅ Reseller authorized for:', resellerVendor);

    // Pick a second vendor they don't sell
    const otherVendors = ['Fortinet', 'Nutanix', 'Arista Networks'].filter(v => v !== resellerVendor);
    const vendor2 = otherVendors[0];

    /* ── Step 1: Buyer submits split-bid RFQ ── */
    const rfqTitle = 'PLAYWRIGHT_SPLIT_LIFECYCLE_' + TS;
    await buyer.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForSelector('#project-title', { timeout: 15000 });
    await buyer.fill('#project-title', rfqTitle);
    await buyer.fill('#project-desc', 'Split lifecycle test');
    const future = new Date(); future.setDate(future.getDate() + 30);
    await buyer.fill('#project-deadline', future.toISOString().slice(0, 10));
    await buyer.fill('#project-city', 'Boston');
    await buyer.selectOption('#project-state', 'MA');
    await buyer.click('#section-1 button.btn-next');

    await buyer.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await buyer.selectOption('#vendor-name-1', resellerVendor);
    await buyer.fill('#sku-part-1-1', 'SPLIT-SKU-001');
    await buyer.fill('#sku-qty-1-1', '2');
    await buyer.click('button.btn-add-vendor');
    await buyer.waitForSelector('#vendor-name-2', { timeout: 5000 });
    await buyer.selectOption('#vendor-name-2', vendor2);
    await buyer.fill('#sku-part-2-1', 'SPLIT-SKU-002');
    await buyer.fill('#sku-qty-2-1', '1');
    await buyer.waitForTimeout(500);
    await buyer.click('#section-2 button.btn-next');

    await buyer.waitForTimeout(1000);
    await buyer.click('#card-split');
    await buyer.waitForTimeout(300);
    await buyer.click('#section-3 button.btn-next');
    await buyer.waitForSelector('#submit-btn', { timeout: 10000 });
    await buyer.click('#submit-btn');
    await expect(buyer.locator('.success-screen')).toBeVisible({ timeout: 20000 });
    console.log('✅ Step 1: Split-bid RFQ submitted');

    await buyer.waitForTimeout(3000);

    /* ── Step 2: Reseller bids on their vendor portion ── */
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForSelector('.tab-btn', { timeout: 20000 });
    await reseller.waitForTimeout(5000);
    await reseller.click('button:has-text("Open RFQs")');
    await reseller.waitForTimeout(2000);

    await reseller.waitForSelector('#open-rfq-grid .rfq-card', { timeout: 20000 });
    const cards = reseller.locator('#open-rfq-grid .rfq-card');
    const cardCount = await cards.count();
    let splitCard = null;
    for (let i = 0; i < cardCount; i++) {
      const txt = await cards.nth(i).textContent();
      if (txt.includes('PLAYWRIGHT_SPLIT_LIFECYCLE_')) { splitCard = cards.nth(i); break; }
    }
    expect(splitCard).not.toBeNull();
    await splitCard.click();
    await reseller.waitForSelector('#bid-modal:not(.hidden)', { timeout: 15000 });
    await reseller.waitForSelector('.sku-price-input', { timeout: 10000 });

    // Fill in prices for only authorized vendor items
    const priceInputs = reseller.locator('.sku-price-input');
    const inputCount = await priceInputs.count();
    for (let i = 0; i < inputCount; i++) {
      await priceInputs.nth(i).fill('500');
    }

    await reseller.click('#bid-submit-btn');
    await reseller.waitForTimeout(3000);
    console.log('✅ Step 2: Reseller bid submitted for their authorized vendor');

    /* ── Step 3: Buyer sees split-bid compare page ── */
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForSelector('button:has-text("View bids")', { timeout: 10000 });
    await buyer.click('button:has-text("View bids")');
    await expect(buyer).toHaveURL(/compare-bids/);

    const url = buyer.url();
    const match = url.match(/rfq=([a-f0-9-]+)/);
    if (match) rfqId = match[1];
    console.log('✅ Step 3: Buyer on compare-bids, RFQ id:', rfqId);

    // Verify split-bid UI is shown — should see vendor sections
    await buyer.waitForTimeout(3000);
    const splitBanner = buyer.locator('text=Split bid');
    await expect(splitBanner.first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Step 3: Split bid UI shown on compare-bids');

    // Verify the reseller vendor section is shown
    await expect(buyer.locator(`text=${resellerVendor}`).first()).toBeVisible({ timeout: 5000 });

    /* ── Step 4: Buyer awards the reseller's vendor ── */
    const awardBtn = buyer.locator(`button:has-text("Award ${resellerVendor}")`).first();
    if (await awardBtn.count() > 0) {
      await awardBtn.click();
      await expect(buyer.locator('#award-overlay')).toHaveClass(/open/);
      await buyer.click('button:has-text("Confirm award")');
      await buyer.waitForTimeout(3000);
      console.log(`✅ Step 4: Buyer awarded ${resellerVendor} vendor`);

      // Check the vendor section now shows awarded
      await expect(buyer.locator(`text=Awarded`).first()).toBeVisible({ timeout: 10000 });
    } else {
      console.log('ℹ️  No award button found — reseller may not have submitted bid with line_items');
    }

    /* ── Step 5: Reseller sees WON status ── */
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await reseller.waitForSelector('.tab-btn', { timeout: 15000 });
    await reseller.waitForTimeout(3000);
    await reseller.click('button:has-text("My bids")');
    await reseller.click('#mybids-pill-won');
    await expect(reseller.locator('.new-tag:has-text("WON")').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Step 5: Reseller sees WON — split-bid lifecycle complete!');

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
    if (rfqId) await cleanupRfq(rfqId);
  }
});
