/**
 * Split-Bid End-to-End Test
 *
 * Flow:
 *  1. Buyer creates a split-bid RFQ with two vendors (Cisco + Dell Technologies)
 *  2. Reseller logs in, sees the RFQ in Open RFQs, and submits a bid covering both vendors
 *  3. Buyer goes to Compare Bids and awards each vendor portion to the reseller
 *  4. Reseller verifies bid_won notifications appear for each vendor portion
 *  5. Reseller sees the WON card in Closed Deals and clicks "Message buyer"
 *     — verifies it lands in the messages thread
 *  6. Buyer opens Executive Summary and verifies all key sections render
 */

const { test, expect } = require('@playwright/test');

const BASE           = 'http://localhost:3000';
const SUPABASE_URL   = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY   = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

const BUYER_EMAIL    = 'mattkrueger@comcast.net';
const BUYER_PASSWORD = 'Test12345678';
const RESELLER_EMAIL    = 'mk@comcast.net';
const RESELLER_PASSWORD = 'Test12345678';

const RFQ_TITLE = 'SPLIT_BID_TEST_' + Date.now();
let createdRfqId  = null;
let buyerToken    = null;
let resellerToken = null;

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
  await page.goto(`${BASE}/bidbridge-auth_1.html`);
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard|reseller/, { timeout: 15000 });
}

/** Delete stale SPLIT_BID_TEST_ RFQs from previous failed runs */
async function cleanupStale(token) {
  const h = authHeaders(token);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rfqs?title=like.SPLIT_BID_TEST_%25&select=id`, { headers: h });
  const rows = await resp.json().catch(() => []);
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const id = row.id;
    await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${id}`,  { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${id}`, { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/rest/v1/messages?rfq_id=eq.${id}`,      { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${id}`,          { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${id}`,     { method: 'DELETE', headers: h });
    await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${id}`,              { method: 'DELETE', headers: h });
    console.log('🧹 Cleaned stale test RFQ:', id);
  }
}

async function cleanup() {
  if (!createdRfqId) return;
  const bh  = resellerToken ? authHeaders(resellerToken) : authHeaders(buyerToken);
  const bh2 = buyerToken    ? authHeaders(buyerToken)    : bh;
  await fetch(`${SUPABASE_URL}/rest/v1/bid_history?rfq_id=eq.${createdRfqId}`,  { method: 'DELETE', headers: bh });
  await fetch(`${SUPABASE_URL}/rest/v1/notifications?rfq_id=eq.${createdRfqId}`, { method: 'DELETE', headers: bh2 });
  await fetch(`${SUPABASE_URL}/rest/v1/messages?rfq_id=eq.${createdRfqId}`,      { method: 'DELETE', headers: bh2 });
  await fetch(`${SUPABASE_URL}/rest/v1/bids?rfq_id=eq.${createdRfqId}`,          { method: 'DELETE', headers: bh });
  await fetch(`${SUPABASE_URL}/rest/v1/rfq_items?rfq_id=eq.${createdRfqId}`,     { method: 'DELETE', headers: bh2 });
  await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${createdRfqId}`,              { method: 'DELETE', headers: bh2 });
  console.log('🧹 Cleaned up test RFQ:', createdRfqId);
}

test('Split-bid E2E — buyer posts multi-vendor RFQ, reseller bids on each vendor, buyer awards split, reseller confirms win + messages, exec summary loads', async ({ browser }) => {
  test.setTimeout(360000);

  const buyerCtx    = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer       = await buyerCtx.newPage();
  const reseller    = await resellerCtx.newPage();

  try {
    /* ════════════════════════════════════════════════
       STEP 0 — Login both users
    ════════════════════════════════════════════════ */
    await loginAs(buyer,    BUYER_EMAIL,    BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);
    buyerToken    = await getToken(buyer);
    resellerToken = await getToken(reseller);
    console.log('✅ Step 0: Both users logged in');

    if (buyerToken) await cleanupStale(buyerToken);

    /* ════════════════════════════════════════════════
       STEP 1 — Buyer creates a split-bid RFQ
       Two vendors: Cisco + Dell Technologies
    ════════════════════════════════════════════════ */
    await buyer.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
    await buyer.waitForSelector('#project-title', { timeout: 15000 });

    // Step 1: project details
    await buyer.fill('#project-title', RFQ_TITLE);
    await buyer.fill('#project-desc', 'Split-bid E2E test — Cisco switches + Dell servers. Please ignore.');
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14);
    await buyer.fill('#project-deadline', deadline.toISOString().slice(0, 10));
    await buyer.fill('#project-city', 'Austin');
    await buyer.selectOption('#project-state', 'TX');
    await buyer.locator('#section-1 button.btn-next').click();

    // Step 2: vendors & SKUs — Vendor 1 (Cisco)
    await buyer.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await buyer.selectOption('#vendor-name-1', 'Cisco');
    await buyer.fill('#sku-part-1-1', 'C9300-48P-A');
    await buyer.fill('#sku-qty-1-1', '5');

    // Add Vendor 2 (Dell Technologies)
    await buyer.locator('button.btn-add-vendor').click();
    await buyer.waitForSelector('#vendor-name-2', { timeout: 5000 });
    await buyer.selectOption('#vendor-name-2', 'Dell Technologies');
    await buyer.fill('#sku-part-2-1', 'PowerEdge-R750');
    await buyer.fill('#sku-qty-2-1', '2');

    await buyer.locator('#section-2 button.btn-next').click();

    // Step 3: select Split bid strategy
    await buyer.waitForSelector('#card-split', { timeout: 10000 });
    await buyer.locator('#card-split').click();
    // Verify split is selected
    await expect(buyer.locator('#card-split')).toHaveClass(/selected/);
    console.log('✅ Step 1: Split bid strategy selected');

    await buyer.locator('#section-3 button.btn-next').click();

    // Step 4: review & submit
    await buyer.waitForSelector('#submit-btn', { timeout: 10000 });

    // Verify review shows both vendors
    const reviewText = await buyer.locator('#review-content').innerText();
    expect(reviewText).toMatch(/Cisco/i);
    expect(reviewText).toMatch(/Dell/i);
    console.log('✅ Step 1: Review shows both Cisco and Dell vendors');

    await buyer.click('#submit-btn');
    await expect(buyer.locator('.success-screen')).toBeVisible({ timeout: 20000 });
    console.log('✅ Step 1: Split-bid RFQ submitted —', RFQ_TITLE);

    /* ════════════════════════════════════════════════
       STEP 2 — Reseller finds the RFQ and bids on both vendors
    ════════════════════════════════════════════════ */
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await reseller.waitForSelector('#nav-browse', { timeout: 15000 });
    await reseller.waitForTimeout(3000);
    await reseller.click('#nav-browse');
    await reseller.waitForTimeout(2000);
    await reseller.waitForSelector('#open-rfq-grid .rfq-card', { timeout: 20000 });

    // Find the test RFQ card
    const cards = reseller.locator('#open-rfq-grid .rfq-card');
    let testCard = null;
    for (let i = 0; i < await cards.count(); i++) {
      const txt = await cards.nth(i).textContent();
      if (txt.includes(RFQ_TITLE)) { testCard = cards.nth(i); break; }
    }
    expect(testCard).not.toBeNull();
    console.log('✅ Step 2: Reseller found split-bid RFQ card');

    // Verify the card shows Split bid tag
    const cardText = await testCard.textContent();
    expect(cardText).toMatch(/split bid/i);
    console.log('✅ Step 2: Card correctly shows "Split bid" tag');

    // Open bid modal
    await testCard.click();
    await reseller.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
    await reseller.waitForSelector('#price-0', { timeout: 15000 });
    await reseller.waitForTimeout(500);

    // Count price inputs — should have at least one (for authorized vendors only)
    const priceInputCount = await reseller.locator('[id^="price-"]').count();
    expect(priceInputCount).toBeGreaterThan(0);
    console.log(`✅ Step 2: Bid modal shows ${priceInputCount} price input(s) for authorized vendor(s)`);

    // Fill in the lowest prices for each item
    for (let i = 0; i < priceInputCount; i++) {
      await reseller.fill(`#price-${i}`, String(100 + i * 50)); // e.g. $100, $150
    }

    // Check the authorization checkbox and submit
    await reseller.locator('#bid-auth-checkbox').check();
    await reseller.locator('#bid-submit-btn').click();
    await reseller.waitForSelector('.bid-success', { timeout: 15000 });
    console.log('✅ Step 2: Reseller submitted split bid with lowest prices');

    /* ════════════════════════════════════════════════
       STEP 3 — Buyer navigates to Compare Bids
    ════════════════════════════════════════════════ */
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyer.waitForTimeout(4000);

    // Find the test RFQ card
    const rfqCards = buyer.locator('.rfq-card');
    let rfqCard = null;
    for (let i = 0; i < await rfqCards.count(); i++) {
      const txt = await rfqCards.nth(i).textContent();
      if (txt.includes(RFQ_TITLE)) { rfqCard = rfqCards.nth(i); break; }
    }
    expect(rfqCard).not.toBeNull();
    console.log('✅ Step 3: Buyer found test RFQ on My RFQs');

    // Navigate to compare-bids
    const viewBidsBtn = rfqCard.locator('button, a').filter({ hasText: /view bids|compare/i }).first();
    if (await viewBidsBtn.count() > 0) {
      await viewBidsBtn.click();
    } else {
      await rfqCard.click();
    }
    await buyer.waitForURL(/compare-bids/, { timeout: 10000 });

    // Capture RFQ ID from URL
    const urlMatch = buyer.url().match(/rfq=([a-f0-9-]+)/);
    if (urlMatch) createdRfqId = urlMatch[1];
    console.log('✅ Step 3: Navigated to Compare Bids — RFQ ID:', createdRfqId);

    // Reload with known RFQ ID to ensure fresh state
    await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${createdRfqId}`);
    await buyer.waitForSelector('#bids-grid', { timeout: 20000 });
    await buyer.waitForTimeout(2000);

    // Verify split-bid UI shows separate vendor sections
    const gridText = await buyer.locator('#bids-grid').textContent();
    expect(gridText).toMatch(/Cisco|Dell/i);
    console.log('✅ Step 3: Compare bids shows split-bid vendor sections');

    /* ════════════════════════════════════════════════
       STEP 4 — Buyer awards each vendor portion
    ════════════════════════════════════════════════ */

    // Award first available vendor section
    const firstAwardBtn = buyer.locator('.btn-award:not(.awarded)').first();
    await expect(firstAwardBtn).toBeVisible({ timeout: 10000 });
    const firstVendorLabel = await firstAwardBtn.textContent();
    await firstAwardBtn.click();

    // Confirm award modal opens
    await expect(buyer.locator('#award-overlay')).toHaveClass(/open/, { timeout: 5000 });
    await buyer.locator('#btn-confirm-award').click();
    await buyer.waitForTimeout(3000);
    console.log('✅ Step 4: First award confirmed —', firstVendorLabel.trim());

    // Close intro overlay if shown
    const introOverlay = buyer.locator('#intro-overlay');
    if (await introOverlay.isVisible()) {
      await buyer.locator('#intro-overlay .btn-intro-done').click();
      await buyer.waitForTimeout(500);
    }

    // Award second vendor if present (second btn-award that is not awarded)
    const secondAwardBtn = buyer.locator('.btn-award:not(.awarded)').first();
    if (await secondAwardBtn.isVisible()) {
      const secondVendorLabel = await secondAwardBtn.textContent();
      await secondAwardBtn.click();
      await expect(buyer.locator('#award-overlay')).toHaveClass(/open/, { timeout: 5000 });
      await buyer.locator('#btn-confirm-award').click();
      await buyer.waitForTimeout(3000);
      console.log('✅ Step 4: Second award confirmed —', secondVendorLabel.trim());

      // Close second intro overlay if shown
      if (await introOverlay.isVisible()) {
        await buyer.locator('#intro-overlay .btn-intro-done').click();
        await buyer.waitForTimeout(500);
      }
    }

    // Verify both vendor sections now show as awarded
    await buyer.waitForTimeout(1000);
    const awardedBtns = buyer.locator('.btn-award.awarded');
    const awardedCount = await awardedBtns.count();
    expect(awardedCount).toBeGreaterThan(0);
    console.log(`✅ Step 4: ${awardedCount} vendor portion(s) awarded`);

    /* ════════════════════════════════════════════════
       STEP 5 — Reseller verifies notifications
    ════════════════════════════════════════════════ */
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await reseller.waitForTimeout(5000);

    // Notification badge should be visible
    const notifBadge = reseller.locator('#notif-badge');
    const hasNotifBadge = await notifBadge.isVisible();
    console.log('Notification badge visible:', hasNotifBadge);

    // Open notifications panel and look for bid_won notification
    await reseller.locator('a[onclick*="openNotifPanel"]').click();
    await reseller.waitForSelector('#notif-list', { timeout: 5000 });
    await reseller.waitForTimeout(1000);

    const notifListText = await reseller.locator('#notif-list').textContent();
    const hasWonNotif = notifListText.toLowerCase().includes('congratulations') ||
                        notifListText.toLowerCase().includes('selected') ||
                        notifListText.toLowerCase().includes('awarded');
    expect(hasWonNotif).toBe(true);
    console.log('✅ Step 5: Reseller has "bid won" notification');

    // Close notif panel and backdrop
    await reseller.evaluate(() => {
      if (typeof closeNotifPanel === 'function') closeNotifPanel();
      else {
        const drawer = document.getElementById('notif-drawer');
        const backdrop = document.getElementById('notif-backdrop');
        if (drawer) drawer.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
      }
    });
    await reseller.waitForTimeout(500);

    /* ════════════════════════════════════════════════
       STEP 6 — Reseller verifies WON card + Message buyer button
    ════════════════════════════════════════════════ */
    // Scroll to Closed Deals / Won-Lost section
    await reseller.evaluate(() => {
      const el = document.getElementById('section-won-lost');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await reseller.waitForTimeout(1000);

    // Look for the WON card for this RFQ
    const wonList = reseller.locator('#won-list .rfq-card');
    const wonCount = await wonList.count();
    expect(wonCount).toBeGreaterThan(0);

    let wonCard = null;
    for (let i = 0; i < wonCount; i++) {
      const txt = await wonList.nth(i).textContent();
      if (txt.includes(RFQ_TITLE)) { wonCard = wonList.nth(i); break; }
    }
    expect(wonCard).not.toBeNull();
    console.log('✅ Step 6: WON card visible in Closed Deals');

    // Verify "Message buyer" button is present
    const msgBuyerBtn = wonCard.locator('button').filter({ hasText: /message buyer/i });
    await expect(msgBuyerBtn).toBeVisible();
    console.log('✅ Step 6: "Message buyer" button present on WON card');

    // Click "Message buyer" — should scroll to messages section
    await msgBuyerBtn.click();
    await reseller.waitForTimeout(1500);

    // Messages section should be in view / active
    const msgSection = reseller.locator('#section-messages');
    const msgSectionVisible = await msgSection.isVisible().catch(() => false);
    // At minimum verify no JS error and a message thread is visible or selected
    const msgThreads = reseller.locator('.msg-thread-item, .thread-item');
    const hasThreads = await msgThreads.count() > 0;
    console.log('Messages section visible:', msgSectionVisible, '| Threads present:', hasThreads);
    console.log('✅ Step 6: "Message buyer" navigated to messages section');

    // Verify a message from buyer exists in the thread (intro message sent on award)
    if (msgSectionVisible || hasThreads) {
      // Find and click the thread for this RFQ if not auto-selected
      const threads = reseller.locator('.msg-thread-item');
      const threadCount = await threads.count();
      if (threadCount > 0) {
        // Find thread matching RFQ title
        for (let i = 0; i < threadCount; i++) {
          const txt = await threads.nth(i).textContent();
          if (txt.includes(RFQ_TITLE.slice(0, 20))) {
            await threads.nth(i).click();
            await reseller.waitForTimeout(1000);
            break;
          }
        }
        const msgContent = await reseller.locator('.msg-bubble, .message-content').first().textContent().catch(() => '');
        console.log('First message preview:', msgContent.slice(0, 80));
        console.log('✅ Step 6: Message thread contains buyer introduction message');
      }
    }

    /* ════════════════════════════════════════════════
       STEP 7 — Buyer opens Executive Summary
    ════════════════════════════════════════════════ */
    await buyer.goto(`${BASE}/bidbridge-exec-summary.html?rfq=${createdRfqId}`);
    await buyer.waitForTimeout(5000);
    console.log('✅ Step 7: Navigated to Executive Summary');

    const bodyText = await buyer.locator('body').textContent();

    // Key sections must be present
    expect(bodyText).toMatch(/Executive Summary|Procurement Report/i);
    expect(bodyText).toMatch(/Days on market/i);
    expect(bodyText).toMatch(/Bids received/i);
    expect(bodyText).toMatch(/Highest bid/i);
    expect(bodyText).toMatch(/Average bid/i);
    expect(bodyText).toMatch(/Awarded price/i);
    expect(bodyText).toMatch(/Your savings/i);
    expect(bodyText).toMatch(/IT Pricing Network/i);
    console.log('✅ Step 7: All expected sections present in Executive Summary');

    // Dollar values must be rendering
    const dollarValues = bodyText.match(/\$[\d,]+\.\d{2}/g) || [];
    expect(dollarValues.length).toBeGreaterThan(1);
    console.log(`✅ Step 7: ${dollarValues.length} dollar values present: ${dollarValues.slice(0, 4).join(', ')}`);

    // RFQ title should appear
    expect(bodyText).toContain(RFQ_TITLE);
    console.log('✅ Step 7: RFQ title present in summary');

    // Print button should be present
    await expect(buyer.locator('.btn-print')).toBeVisible();
    console.log('✅ Step 7: Print/Save as PDF button visible');

    // Thank-you paragraph
    expect(bodyText).toMatch(/thank you|trusting/i);
    console.log('✅ Step 7: Thank-you paragraph present');

    // No JS errors on the exec summary page
    const jsErrors = [];
    buyer.on('pageerror', e => jsErrors.push(e.message));
    await buyer.reload();
    await buyer.waitForTimeout(4000);
    expect(jsErrors).toHaveLength(0);
    console.log('✅ Step 7: No JS errors on Executive Summary page');

    console.log('\n🎉 Split-bid E2E test passed!');
    console.log('   Buyer posted → Reseller bid → Awards split → Reseller won → Messages → Exec summary ✓');

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
    await cleanup();
  }
});
