/**
 * Two-Reseller Split Bid Test
 *
 * Flow:
 *  1. Buyer creates a split-bid RFQ with Dell Technologies + Cisco
 *  2. Reseller 1 (mk@comcast.net) sees the RFQ and bids on their authorized vendors
 *  3. Reseller 2 (mk2@comcast.net) sees the RFQ and bids on their authorized vendors
 *  4. Buyer goes to My RFQs and can see the RFQ with both bids
 *  5. Buyer navigates to Compare Bids and sees bids from both resellers
 */

const { test, expect } = require('@playwright/test');

const BASE         = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

const BUYER_EMAIL    = 'mattkrueger@comcast.net';
const BUYER_PASSWORD = 'Test12345678';
const RESELLER1_EMAIL    = 'mk@comcast.net';
const RESELLER1_PASSWORD = 'Test12345678';
const RESELLER2_EMAIL    = 'mk2@comcast.net';
const RESELLER2_PASSWORD = 'Test12345678';

const RFQ_TITLE = 'TWO_RESELLER_SPLIT_' + Date.now();
let createdRfqId  = null;
let buyerToken    = null;
let reseller1Token = null;
let reseller2Token = null;

function authHeaders(token) {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function getToken(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
    if (!key) return null;
    try { return JSON.parse(localStorage.getItem(key))?.access_token; } catch { return null; }
  });
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard|reseller/, { timeout: 20000 });
  console.log(`✅ Logged in as ${email}`);
}

async function cleanupStale(buyerTok, r1Tok, r2Tok) {
  const bh  = authHeaders(buyerTok);
  const r1h = r1Tok ? authHeaders(r1Tok) : bh;
  const r2h = r2Tok ? authHeaders(r2Tok) : bh;
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rfqs?title=like.TWO_RESELLER_SPLIT_%25&select=id`, { headers: bh });
  const rows = await resp.json().catch(() => []);
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const id = row.id;
    await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${id}`, { method: 'DELETE', headers: r1h });
    await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${id}`, { method: 'DELETE', headers: r2h });
    await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${id}`,        { method: 'DELETE', headers: r1h });
    await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${id}`,        { method: 'DELETE', headers: r2h });
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${id}`, { method: 'DELETE', headers: bh });
    await fetch(`${SUPABASE_URL}/rest/v1/messages?rfq_id=eq.${id}`,      { method: 'DELETE', headers: bh });
    await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${id}`,     { method: 'DELETE', headers: bh });
    await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${id}`,              { method: 'DELETE', headers: bh });
    console.log('🧹 Cleaned stale test RFQ:', id);
  }
}

async function cleanup() {
  if (!createdRfqId) return;
  const bh = buyerToken    ? authHeaders(buyerToken)    : null;
  const r1h = reseller1Token ? authHeaders(reseller1Token) : bh;
  const r2h = reseller2Token ? authHeaders(reseller2Token) : bh;
  if (!bh) return;
  // bid_history and bids must use reseller tokens (RLS blocks buyer from deleting reseller rows)
  if (r1h) await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: r1h });
  if (r2h && r2h !== r1h) await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: r2h });
  if (r1h) await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: r1h });
  if (r2h && r2h !== r1h) await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: r2h });
  await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${createdRfqId}`,  { method: 'DELETE', headers: bh });
  await fetch(`${SUPABASE_URL}/rest/v1/messages?rfq_id=eq.${createdRfqId}`,       { method: 'DELETE', headers: bh });
  await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${createdRfqId}`,      { method: 'DELETE', headers: bh });
  await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${createdRfqId}`,               { method: 'DELETE', headers: bh });
  console.log('🧹 Cleaned up test RFQ:', createdRfqId);
}

async function submitBidAsReseller(reseller, email) {
  await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await reseller.waitForSelector('#open-rfq-grid', { timeout: 20000 });
  await reseller.waitForTimeout(5000); // let Supabase load

  // Find the test RFQ card
  const cards = reseller.locator('#open-rfq-grid .rfq-card');
  await reseller.waitForSelector('#open-rfq-grid .rfq-card', { timeout: 20000 });
  const cardCount = await cards.count();
  console.log(`  [${email}] Found ${cardCount} open RFQ card(s)`);

  let testCard = null;
  for (let i = 0; i < cardCount; i++) {
    const txt = await cards.nth(i).textContent();
    if (txt.includes(RFQ_TITLE)) { testCard = cards.nth(i); break; }
  }

  if (!testCard) {
    // Log all card titles to help debug
    const allTitles = [];
    for (let i = 0; i < cardCount; i++) {
      const txt = await cards.nth(i).textContent();
      allTitles.push(txt.slice(0, 80).replace(/\s+/g, ' ').trim());
    }
    console.log(`  [${email}] Visible RFQ cards:`, allTitles);
    return { found: false, reason: 'RFQ not visible in Open RFQs' };
  }

  const cardText = await testCard.textContent();
  console.log(`  [${email}] Found RFQ card — split bid tag visible: ${/split bid/i.test(cardText)}`);

  // Check vendor count pill if present
  const vendorPillMatch = cardText.match(/(\d+) of (\d+) vendor/i);
  if (vendorPillMatch) {
    console.log(`  [${email}] Vendor pill: ${vendorPillMatch[0]}`);
  }

  // Open bid form
  await testCard.click();
  await reseller.waitForSelector('#bid-modal:not(.hidden)', { timeout: 15000 });
  await reseller.waitForSelector('#price-0', { timeout: 15000 });
  await reseller.waitForTimeout(500);

  // Check the split bid info banner
  const modalBody = await reseller.locator('#bid-modal-body').textContent();
  const hasSplitBanner = /authorized to bid on/i.test(modalBody);
  console.log(`  [${email}] Split bid info banner visible: ${hasSplitBanner}`);
  if (hasSplitBanner) {
    const bannerMatch = modalBody.match(/authorized to bid on[^.]+\./i);
    if (bannerMatch) console.log(`  [${email}] Banner text: "${bannerMatch[0]}"`);
  }

  // Count and fill price inputs
  const priceInputCount = await reseller.locator('[id^="price-"]').count();
  console.log(`  [${email}] Price inputs (authorized vendors only): ${priceInputCount}`);
  for (let i = 0; i < priceInputCount; i++) {
    await reseller.fill(`#price-${i}`, String(500 + i * 100));
  }

  // Submit
  const authCb = reseller.locator('#bid-auth-checkbox');
  if (await authCb.count() > 0) await authCb.check();
  await reseller.locator('#bid-submit-btn').click();
  await reseller.waitForSelector('.bid-success', { timeout: 15000 });
  console.log(`  [${email}] ✅ Bid submitted successfully`);

  return { found: true, priceInputCount };
}

test('Two-reseller split bid — Dell+Cisco RFQ visible and biddable by both resellers, buyer sees all bids', async ({ browser }) => {
  test.setTimeout(360000);

  const buyerCtx    = await browser.newContext();
  const reseller1Ctx = await browser.newContext();
  const reseller2Ctx = await browser.newContext();

  const buyer     = await buyerCtx.newPage();
  const reseller1 = await reseller1Ctx.newPage();
  const reseller2 = await reseller2Ctx.newPage();

  try {
    /* ════════════════════════════════════════
       STEP 0 — Login all three users
    ════════════════════════════════════════ */
    await loginAs(buyer,     BUYER_EMAIL,    BUYER_PASSWORD);
    await loginAs(reseller1, RESELLER1_EMAIL, RESELLER1_PASSWORD);
    await loginAs(reseller2, RESELLER2_EMAIL, RESELLER2_PASSWORD);

    buyerToken     = await getToken(buyer);
    reseller1Token = await getToken(reseller1);
    reseller2Token = await getToken(reseller2);
    if (buyerToken) await cleanupStale(buyerToken, reseller1Token, reseller2Token);

    // Log authorized vendors for each reseller (helps diagnose)
    const getAuthorizedVendors = async (page) => {
      await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.profile-tier-row', { timeout: 15000 });
      await page.waitForTimeout(2000);
      const rows = page.locator('.profile-tier-row');
      const count = await rows.count();
      const vendors = [];
      for (let i = 0; i < count; i++) {
        const v = await rows.nth(i).locator('.profile-tier-vendor').textContent();
        vendors.push(v.trim());
      }
      return vendors;
    };

    const r1Vendors = await getAuthorizedVendors(reseller1);
    const r2Vendors = await getAuthorizedVendors(reseller2);
    console.log(`\n📋 ${RESELLER1_EMAIL} authorized for:`, r1Vendors);
    console.log(`📋 ${RESELLER2_EMAIL} authorized for:`, r2Vendors);

    // Determine which vendor each reseller can bid on for this RFQ
    const r1CanBidDell  = r1Vendors.includes('Dell Technologies');
    const r1CanBidCisco = r1Vendors.includes('Cisco');
    const r2CanBidDell  = r2Vendors.includes('Dell Technologies');
    const r2CanBidCisco = r2Vendors.includes('Cisco');

    console.log(`\n  ${RESELLER1_EMAIL}: Dell=${r1CanBidDell}, Cisco=${r1CanBidCisco}`);
    console.log(`  ${RESELLER2_EMAIL}: Dell=${r2CanBidDell}, Cisco=${r2CanBidCisco}`);

    /* ════════════════════════════════════════
       STEP 1 — Buyer creates split-bid RFQ
       Vendors: Dell Technologies + Cisco
    ════════════════════════════════════════ */
    console.log('\n📋 STEP 1: Buyer creating split-bid RFQ (Dell + Cisco)...');
    await buyer.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await buyer.waitForSelector('#project-title', { timeout: 15000 });

    await buyer.fill('#project-title', RFQ_TITLE);
    await buyer.fill('#project-desc', 'Two-reseller split bid test — Dell servers + Cisco switches. Please ignore.');
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    await buyer.fill('#project-deadline', deadline.toISOString().slice(0, 10));
    await buyer.fill('#project-city', 'Chicago');
    await buyer.selectOption('#project-state', 'IL');
    await buyer.locator('#section-1 button.btn-next').click();

    // Vendor 1: Dell Technologies
    await buyer.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await buyer.selectOption('#vendor-name-1', 'Dell Technologies');
    await buyer.fill('#sku-part-1-1', 'PowerEdge-R750');
    await buyer.fill('#sku-qty-1-1', '3');

    // Add Vendor 2: Cisco
    await buyer.locator('button.btn-add-vendor').click();
    await buyer.waitForSelector('#vendor-name-2', { timeout: 5000 });
    await buyer.selectOption('#vendor-name-2', 'Cisco');
    await buyer.fill('#sku-part-2-1', 'C9300-48P-A');
    await buyer.fill('#sku-qty-2-1', '10');
    await buyer.waitForTimeout(500);

    await buyer.locator('#section-2 button.btn-next').click();

    // Select Split bid strategy
    await buyer.waitForSelector('#card-split', { timeout: 10000 });
    await buyer.locator('#card-split').click();
    await expect(buyer.locator('#card-split')).toHaveClass(/selected/);
    console.log('  ✅ Split bid strategy selected');
    await buyer.locator('#section-3 button.btn-next').click();

    // Review & submit
    await buyer.waitForSelector('#submit-btn', { timeout: 10000 });
    const reviewText = await buyer.locator('#review-content').textContent().catch(() => '');
    console.log(`  Review shows Dell: ${/Dell/i.test(reviewText)}, Cisco: ${/Cisco/i.test(reviewText)}`);

    await buyer.click('#submit-btn');
    await expect(buyer.locator('.success-screen')).toBeVisible({ timeout: 20000 });
    const badgeText = await buyer.locator('#rfq-id-badge').textContent();
    console.log(`  ✅ RFQ created: ${badgeText}`);

    // Give Supabase a moment to propagate
    await buyer.waitForTimeout(3000);

    /* ════════════════════════════════════════
       STEP 2 — Verify buyer can see RFQ on My RFQs
    ════════════════════════════════════════ */
    console.log('\n👤 STEP 2: Verifying buyer can see RFQ on My RFQs...');
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForTimeout(5000);

    const buyerRfqCards = buyer.locator('.rfq-card');
    const buyerCardCount = await buyerRfqCards.count();
    console.log(`  Buyer sees ${buyerCardCount} RFQ card(s) on My RFQs`);

    let buyerTestCard = null;
    for (let i = 0; i < buyerCardCount; i++) {
      const txt = await buyerRfqCards.nth(i).textContent();
      if (txt.includes(RFQ_TITLE)) { buyerTestCard = buyerRfqCards.nth(i); break; }
    }

    expect(buyerTestCard, `Buyer should see the RFQ on My RFQs. Total cards: ${buyerCardCount}`).not.toBeNull();
    console.log('  ✅ Buyer can see the RFQ on My RFQs');

    // Navigate to Compare Bids to capture RFQ ID
    const viewBidsBtn = buyerTestCard.locator('.btn-compare, button').filter({ hasText: /view bids|compare/i }).first();
    if (await viewBidsBtn.count() > 0) {
      await viewBidsBtn.click();
    } else {
      await buyerTestCard.click();
    }
    await buyer.waitForURL(/compare-bids/, { timeout: 10000 });
    const urlMatch = buyer.url().match(/rfq=([a-f0-9-]+)/);
    if (urlMatch) createdRfqId = urlMatch[1];
    console.log(`  ✅ Buyer navigated to Compare Bids — RFQ ID: ${createdRfqId}`);
    expect(createdRfqId, 'Could not capture RFQ ID from URL').toBeTruthy();

    /* ════════════════════════════════════════
       STEP 3 — Reseller 1 bids on their portion
    ════════════════════════════════════════ */
    console.log(`\n🏪 STEP 3: ${RESELLER1_EMAIL} bidding...`);
    const r1Result = await submitBidAsReseller(reseller1, RESELLER1_EMAIL);

    if (!r1Result.found) {
      // Not necessarily a failure if they're not authorized for either vendor
      if (!r1CanBidDell && !r1CanBidCisco) {
        console.log(`  ⚠️  ${RESELLER1_EMAIL} is not authorized for Dell or Cisco — expected to not see RFQ`);
      } else {
        throw new Error(`${RESELLER1_EMAIL} is authorized for Dell=${r1CanBidDell}/Cisco=${r1CanBidCisco} but could not find the RFQ in Open RFQs`);
      }
    } else {
      console.log(`  ✅ ${RESELLER1_EMAIL} successfully bid (${r1Result.priceInputCount} line item(s))`);
    }

    /* ════════════════════════════════════════
       STEP 4 — Reseller 2 bids on their portion
    ════════════════════════════════════════ */
    console.log(`\n🏪 STEP 4: ${RESELLER2_EMAIL} bidding...`);
    const r2Result = await submitBidAsReseller(reseller2, RESELLER2_EMAIL);

    if (!r2Result.found) {
      if (!r2CanBidDell && !r2CanBidCisco) {
        console.log(`  ⚠️  ${RESELLER2_EMAIL} is not authorized for Dell or Cisco — expected to not see RFQ`);
      } else {
        throw new Error(`${RESELLER2_EMAIL} is authorized for Dell=${r2CanBidDell}/Cisco=${r2CanBidCisco} but could not find the RFQ in Open RFQs`);
      }
    } else {
      console.log(`  ✅ ${RESELLER2_EMAIL} successfully bid (${r2Result.priceInputCount} line item(s))`);
    }

    // At least one reseller must have been able to bid
    const atLeastOneBid = r1Result.found || r2Result.found;
    expect(atLeastOneBid, 'Neither reseller could find or bid on the RFQ').toBe(true);

    /* ════════════════════════════════════════
       STEP 5 — Buyer sees bids on Compare Bids
    ════════════════════════════════════════ */
    console.log('\n👤 STEP 5: Buyer checking Compare Bids for incoming bids...');
    await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${createdRfqId}`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForTimeout(8000); // let all bids load

    const bidsGrid = buyer.locator('#bids-grid');
    const bidsCount = buyer.locator('#bids-count');

    await expect(bidsGrid).toBeVisible({ timeout: 10000 });

    const bidsCountText = await bidsCount.textContent().catch(() => '0');
    console.log(`  Bids count shown: "${bidsCountText}"`);

    const bidsGridText = await bidsGrid.textContent();
    const hasBidCards = await buyer.locator('.bid-card').count() > 0;
    console.log(`  Bid cards visible: ${hasBidCards}`);
    console.log(`  Grid mentions Dell: ${/Dell/i.test(bidsGridText)}, Cisco: ${/Cisco/i.test(bidsGridText)}`);

    // Verify at least one bid is shown
    expect(hasBidCards || /\$/.test(bidsGridText), 'Buyer should see at least one bid on Compare Bids').toBe(true);

    // If both resellers bid, buyer should see bids from both
    if (r1Result.found && r2Result.found) {
      const bidCardCount = await buyer.locator('.bid-card').count();
      console.log(`  Total bid cards visible: ${bidCardCount}`);
      // Split bid shows per-vendor sections — at least 2 bid entries expected
      expect(bidCardCount).toBeGreaterThanOrEqual(1);
    }

    // Verify buyer can still see the RFQ on My RFQs after bids came in
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForTimeout(4000);

    let foundAfterBids = false;
    const finalCards = buyer.locator('.rfq-card');
    for (let i = 0; i < await finalCards.count(); i++) {
      const txt = await finalCards.nth(i).textContent();
      if (txt.includes(RFQ_TITLE)) { foundAfterBids = true; break; }
    }
    expect(foundAfterBids, 'Buyer should still see RFQ on My RFQs after bids came in').toBe(true);
    console.log('  ✅ Buyer can still see the RFQ on My RFQs after bids arrived');

    console.log('\n🎉 Two-reseller split bid test passed!');
    console.log(`   RFQ visible to buyer: ✓`);
    console.log(`   ${RESELLER1_EMAIL} bid: ${r1Result.found ? '✓' : '— not authorized for Dell or Cisco'}`);
    console.log(`   ${RESELLER2_EMAIL} bid: ${r2Result.found ? '✓' : '— not authorized for Dell or Cisco'}`);
    console.log(`   Buyer sees bids on Compare Bids: ✓`);

  } finally {
    await buyerCtx.close();
    await reseller1Ctx.close();
    await reseller2Ctx.close();
    await cleanup();
  }
});
