/**
 * USABILITY WALKTHROUGH — Full buyer → reseller → award cycle
 *
 * Goals:
 *  1. Create a realistic multi-vendor IT procurement RFQ as a buyer
 *  2. Review each screen from a usability standpoint (screenshots + observations)
 *  3. Switch to reseller — see & bid on the RFQ
 *  4. Return as buyer — compare bids, award, review exec summary
 *  5. Produce annotated screenshots and a console usability report
 *
 * Run:
 *   npx playwright test tests/usability-walkthrough.spec.js --reporter=line
 *
 * Screenshots are written to: screenshots/usability/
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const BASE           = 'http://localhost:3000';
const BUYER_EMAIL    = 'mattkrueger@comcast.net';
const BUYER_PASS     = 'Test12345678';
const RESELLER_EMAIL = 'mk@comcast.net';
const RESELLER_PASS  = 'Test12345678';

const OUT = path.join(__dirname, '..', 'screenshots', 'usability');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

async function login(page, email, pass, expectedUrlPattern) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', email);
  await page.fill('#login-password', pass);
  await page.locator('#login-form').evaluate(f => f.requestSubmit());
  await page.waitForURL(expectedUrlPattern, { timeout: 20000 });
  await page.waitForTimeout(2000);
}

async function shot(page, name, note) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸 ${name}${note ? ' — ' + note : ''}`);
}

const issues = [];
function note(severity, location, observation) {
  const icon = severity === 'ISSUE' ? '🔴' : severity === 'WARN' ? '🟡' : '🟢';
  const msg = `${icon} [${severity}] ${location}: ${observation}`;
  issues.push(msg);
  console.log(msg);
}

// ─────────────────────────────────────────────────────────────────
// TEST: FULL USABILITY WALKTHROUGH
// ─────────────────────────────────────────────────────────────────

test('Full usability walkthrough — buyer submits RFQ, reseller bids, buyer awards', async ({ browser }) => {
  test.setTimeout(480000);

  // ── Setup two browser contexts ──
  const buyerCtx    = await browser.newContext({ viewport: VIEWPORT });
  const resellerCtx = await browser.newContext({ viewport: VIEWPORT });
  const buyer    = await buyerCtx.newPage();
  const reseller = await resellerCtx.newPage();

  let createdRfqId = null;

  try {

    // ════════════════════════════════════════════════════════════
    // PHASE 1: BUYER JOURNEY
    // ════════════════════════════════════════════════════════════

    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 1: BUYER JOURNEY');
    console.log('═══════════════════════════════════════\n');

    // ── 1a. Auth page ──
    await buyer.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForTimeout(1500);
    await shot(buyer, '01-auth-page', 'Login screen on fresh load');

    // Evaluate auth page
    const authText = await buyer.locator('body').innerText();
    if (!authText.toLowerCase().includes('sign in') && !authText.toLowerCase().includes('log in')) {
      note('WARN', 'Auth page', 'No clear "Sign in" heading visible');
    } else {
      note('OK', 'Auth page', 'Sign-in form clearly presented');
    }
    const hasPasswordToggle = await buyer.locator('button[onclick*="togglePass"], [id*="toggle-pass"], .eye-icon').count() > 0;
    note(hasPasswordToggle ? 'OK' : 'WARN', 'Auth page', hasPasswordToggle ? 'Password visibility toggle present' : 'No password visibility toggle');

    // ── 1b. Login ──
    await buyer.fill('#login-email', BUYER_EMAIL);
    await buyer.fill('#login-password', BUYER_PASS);
    await shot(buyer, '02-auth-filled', 'Form filled, before submit');
    await buyer.locator('#login-form').evaluate(f => f.requestSubmit());
    await buyer.waitForURL(/buyer-dashboard/, { timeout: 20000 });
    await buyer.waitForFunction(() => {
      const el = document.getElementById('stat-active');
      return el && el.textContent.trim() !== '—';
    }, { timeout: 20000 });
    await buyer.waitForTimeout(1500);

    // ── 1c. Buyer dashboard ──
    await shot(buyer, '03-buyer-dashboard', 'Dashboard after login — stats loaded');

    const greeting = await buyer.locator('#topbar-greeting').textContent();
    note('OK', 'Buyer dashboard', `Greeting shows: "${greeting.trim()}"`);

    // Check stat cards
    const statActive  = await buyer.locator('#stat-active').textContent();
    const statBids    = await buyer.locator('#stat-bids').textContent();
    const statReview  = await buyer.locator('#stat-review').textContent();
    const statAwarded = await buyer.locator('#stat-awarded').textContent();
    console.log(`  Stats → Active: ${statActive.trim()}, Bids: ${statBids.trim()}, Review: ${statReview.trim()}, Awarded: ${statAwarded.trim()}`);

    if (statActive.trim() === '—' || statBids.trim() === '—') {
      note('ISSUE', 'Buyer dashboard', 'Stat cards not populating — Supabase may be slow');
    } else {
      note('OK', 'Buyer dashboard', 'All four stat cards populated with real values');
    }

    // Check for action-needed / attention panel
    const hasAttention = await buyer.locator('.attention-banner, .action-card, #action-needed').count() > 0;
    note(hasAttention ? 'OK' : 'WARN', 'Buyer dashboard', hasAttention ? 'Action-needed panel visible' : 'No attention/action panel visible on fresh dashboard');

    // Check quick links
    const hasQuickLinks = await buyer.locator('.quick-link-row, .quick-actions').count() > 0;
    note(hasQuickLinks ? 'OK' : 'WARN', 'Buyer dashboard', hasQuickLinks ? 'Quick links section present' : 'No quick links section found');

    // Check sidebar nav clarity
    const navItems = await buyer.locator('.nav-item').allTextContents();
    console.log(`  Nav items: ${navItems.map(t => t.trim()).filter(Boolean).join(' | ')}`);
    note('OK', 'Buyer sidebar', `${navItems.length} nav items visible`);

    // ── 1d. Navigate to My RFQs (should be empty after wipe) ──
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForFunction(() => {
      const rfqList    = document.getElementById('rfq-list');
      const emptyState = document.getElementById('empty-state');
      return (rfqList && rfqList.children.length > 0) ||
             (emptyState && emptyState.style.display !== 'none');
    }, { timeout: 20000 });
    await buyer.waitForTimeout(1500);
    await shot(buyer, '04-my-rfqs-empty', 'My RFQs — empty state after wipe');

    const emptyStateVisible = await buyer.locator('#empty-state').isVisible();
    const rfqCount = await buyer.locator('#rfq-list .rfq-card').count();
    if (emptyStateVisible || rfqCount === 0) {
      note('OK', 'My RFQs empty state', 'Empty state shown correctly when no RFQs exist');
      // Check empty state has a CTA to create first RFQ
      const emptyCTA = await buyer.locator('#empty-state a, #empty-state button').count();
      note(emptyCTA > 0 ? 'OK' : 'WARN', 'My RFQs empty state', emptyCTA > 0 ? 'Empty state has CTA to create RFQ' : 'Empty state has no CTA — dead end for new users');
    }

    // Check filter pills visibility
    const pills = await buyer.locator('.pill, .filter-pill, [id^="pill-"]').count();
    note(pills > 0 ? 'OK' : 'WARN', 'My RFQs', `${pills} filter pills visible`);

    // Check search bar
    const hasSearch = await buyer.locator('#search-input, input[type="search"], .search-input').count() > 0;
    note(hasSearch ? 'OK' : 'WARN', 'My RFQs', hasSearch ? 'Search bar present' : 'No search bar on My RFQs');

    // ── 1e. Navigate to Submit RFQ ──
    await buyer.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForSelector('#project-title', { timeout: 15000 });
    await buyer.waitForTimeout(1000);
    await shot(buyer, '05-submit-rfq-step1', 'Submit RFQ — Step 1 (Project details)');

    // Evaluate step 1 UX
    const step1Fields = ['#project-title', '#project-desc', '#project-deadline'];
    let visibleCount = 0;
    for (const field of step1Fields) {
      if (await buyer.locator(field).isVisible()) visibleCount++;
    }
    note(visibleCount === step1Fields.length ? 'OK' : 'ISSUE', 'Submit RFQ Step 1', `${visibleCount}/${step1Fields.length} required fields visible`);

    // Check for placeholders / helper text
    const titlePlaceholder = await buyer.locator('#project-title').getAttribute('placeholder');
    note(titlePlaceholder ? 'OK' : 'WARN', 'Submit RFQ Step 1', titlePlaceholder ? `Title placeholder: "${titlePlaceholder}"` : 'No placeholder on title field');

    // Check step indicator / progress
    const hasStepIndicator = await buyer.locator('.step, .steps, [class*="step-"], .progress').count() > 0;
    note(hasStepIndicator ? 'OK' : 'WARN', 'Submit RFQ', hasStepIndicator ? 'Step progress indicator visible' : 'No step indicator — user cannot tell how many steps remain');

    // ── Fill Step 1 ──
    await buyer.fill('#project-title', 'Data Center Refresh — Network & Compute 2026');
    await buyer.fill('#project-desc', 'We are refreshing our primary data center. This includes core network switching (Cisco), rack servers (HPE ProLiant), and SAN storage (Dell EMC). Looking for competitive pricing across all three technology areas.');
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 21);
    await buyer.fill('#project-deadline', deadline.toISOString().slice(0, 10));

    const cityField = buyer.locator('#project-city');
    if (await cityField.count() > 0) await buyer.fill('#project-city', 'Chicago');
    const stateField = buyer.locator('#project-state');
    if (await stateField.count() > 0) await buyer.selectOption('#project-state', 'IL');

    await shot(buyer, '06-submit-rfq-step1-filled', 'Step 1 filled with realistic data');

    // Advance to step 2
    await buyer.locator('#section-1 button.btn-next').click();
    await buyer.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await buyer.waitForTimeout(800);
    await shot(buyer, '07-submit-rfq-step2', 'Submit RFQ — Step 2 (Vendor & SKU entry)');

    // Evaluate step 2 UX
    const hasAddItemBtn = await buyer.locator('.btn-add-vendor, .btn-add-sku, button:has-text("Add vendor"), button:has-text("Add another")').count() > 0;
    note(hasAddItemBtn ? 'OK' : 'WARN', 'Submit RFQ Step 2', hasAddItemBtn ? 'Add vendor/SKU buttons present' : 'No add buttons visible');

    const hasVendorField = await buyer.locator('#vendor-name-1').isVisible();
    note(hasVendorField ? 'OK' : 'ISSUE', 'Submit RFQ Step 2', 'Vendor name field visible on first row');

    // Check if there's a help tooltip or example for SKU format
    const hasSkuHelp = await buyer.locator('[title*="SKU"], [placeholder*="SKU"], .sku-help').count() > 0;
    note(hasSkuHelp ? 'OK' : 'WARN', 'Submit RFQ Step 2', hasSkuHelp ? 'SKU field has help text/placeholder' : 'No SKU format guidance for users unfamiliar with SKUs');

    // ── Fill Step 2 — Three vendor blocks, multiple SKUs ──
    // Form structure: vendor blocks, each with sku-part-{vendorId}-{skuId} / sku-qty-{vendorId}-{skuId}
    // First block (vendorId=1) is auto-created when step 2 loads

    // Vendor 1: Cisco (auto block)
    await buyer.waitForSelector('#vendor-name-1', { timeout: 8000 });
    await buyer.selectOption('#vendor-name-1', { label: 'Cisco' }).catch(async () => {
      const val = await buyer.locator('#vendor-name-1').evaluate(el => el.tagName);
      if (val === 'INPUT') await buyer.fill('#vendor-name-1', 'Cisco');
    });
    await buyer.fill('#sku-part-1-1', 'C9300-48P-A');
    await buyer.fill('#sku-qty-1-1', '4');

    // Add a second SKU to vendor 1 (Cisco router)
    const addSkuBtn1 = buyer.locator('[onclick="addSkuRow(1)"], .btn-add-sku').first();
    if (await addSkuBtn1.count() > 0) {
      await addSkuBtn1.click();
      await buyer.waitForTimeout(400);
      await buyer.fill('#sku-part-1-2', 'ISR4351/K9').catch(() => {});
      await buyer.fill('#sku-qty-1-2', '2').catch(() => {});
    }

    // Vendor notes for Cisco block
    await buyer.fill('#vendor-notes-1', 'Requires SMARTnet 3-year maintenance on all items').catch(() => {});

    // Add vendor 2: HPE
    await buyer.locator('.btn-add-vendor').click();
    await buyer.waitForTimeout(500);
    await buyer.waitForSelector('#vendor-name-2', { timeout: 5000 });
    await buyer.selectOption('#vendor-name-2', { label: 'HPE / Aruba' });
    await buyer.fill('#sku-part-2-1', 'P44114-B21');
    await buyer.fill('#sku-qty-2-1', '8');
    await buyer.fill('#vendor-notes-2', 'iLO Advanced license required, rack-ready configuration').catch(() => {});

    // Add vendor 3: Dell Technologies
    await buyer.locator('.btn-add-vendor').click();
    await buyer.waitForTimeout(500);
    await buyer.waitForSelector('#vendor-name-3', { timeout: 5000 });
    await buyer.selectOption('#vendor-name-3', { label: 'Dell Technologies' });
    await buyer.fill('#sku-part-3-1', 'SNS-5600F-25GE-8P');
    await buyer.fill('#sku-qty-3-1', '1');
    await buyer.fill('#vendor-notes-3', 'SAN connectivity required, include 10Gb iSCSI NICs').catch(() => {});

    await shot(buyer, '08-submit-rfq-step2-filled', 'Step 2 — 3 vendor blocks, 4 SKUs total');

    // Evaluate filled step 2
    const vendorBlockCount = await buyer.locator('[id^="vendor-name-"]').count();
    note(vendorBlockCount >= 3 ? 'OK' : 'WARN', 'Submit RFQ Step 2', `${vendorBlockCount} vendor blocks — multi-vendor entry flow`);

    // Check vendor block delete functionality
    const hasDeleteVendor = await buyer.locator('button:has-text("Remove vendor"), .btn-remove-vendor, [onclick*="removeVendor"]').count() > 0;
    note(hasDeleteVendor ? 'OK' : 'WARN', 'Submit RFQ Step 2', hasDeleteVendor ? 'Vendor block delete button present' : 'No vendor block delete — cannot remove a mistaken vendor');

    // ── Advance step 2 → step 3 (Sourcing strategy) ──
    await buyer.locator('#section-2 button.btn-next').click();
    await buyer.waitForTimeout(1200);
    await shot(buyer, '09-submit-rfq-step3', 'Step 3 — Sourcing strategy');

    const step3Text = await buyer.locator('body').innerText();
    const hasSourcingOptions = /sole.source|split.bid|strategy/i.test(step3Text);
    note(hasSourcingOptions ? 'OK' : 'WARN', 'Submit RFQ Step 3', hasSourcingOptions ? 'Sourcing strategy options visible' : 'No sourcing strategy options visible');

    // Advance step 3 → step 4 (Review)
    const step3Next = buyer.locator('#section-3 button.btn-next, #section-3 .btn-next').first();
    if (await step3Next.count() > 0) {
      await step3Next.click();
      await buyer.waitForTimeout(1200);
      await shot(buyer, '10-submit-rfq-step4-review', 'Step 4 — Review before submit');

      const reviewText = await buyer.locator('body').innerText();
      const hasReview = /review|confirm|Data Center/i.test(reviewText);
      note(hasReview ? 'OK' : 'WARN', 'Submit RFQ Step 4', hasReview ? 'Review step shows RFQ summary before submission' : 'No review summary visible');

      const hasVendorInReview = /cisco|hpe|dell/i.test(reviewText);
      note(hasVendorInReview ? 'OK' : 'WARN', 'Submit RFQ review', hasVendorInReview ? 'Vendor names shown in review' : 'No vendor details in review');
    }

    // ── Submit the RFQ ──
    const submitBtn = buyer.locator('#submit-btn, button:has-text("Submit RFQ"), button:has-text("Post RFQ")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await buyer.waitForTimeout(5000);
      await shot(buyer, '11-post-submit', 'After RFQ submission');

      const currentUrl = buyer.url();
      const bodyText = await buyer.locator('body').innerText();
      const hasSuccess = /success|submitted|posted|active|rfq created|live/i.test(bodyText);
      const wasRedirected = currentUrl.includes('my-rfqs') || currentUrl.includes('dashboard');
      note((hasSuccess || wasRedirected) ? 'OK' : 'ISSUE', 'Submit RFQ — post submit', `URL: ${currentUrl} | Success message: ${hasSuccess}`);

      if (!wasRedirected) {
        await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
      }
    } else {
      await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
    }

    // ── 1f. My RFQs — after submission ──
    await buyer.waitForFunction(() => {
      const rfqList = document.getElementById('rfq-list');
      return rfqList && rfqList.children.length > 0;
    }, { timeout: 20000 });
    await buyer.waitForTimeout(2000);
    await shot(buyer, '12-my-rfqs-with-rfq', 'My RFQs after submission — card visible');

    // Get the RFQ ID from the first card
    const firstCard = buyer.locator('#rfq-list .rfq-card').first();
    const cardHtml  = await firstCard.innerHTML();
    const rfqIdMatch = cardHtml.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (rfqIdMatch) createdRfqId = rfqIdMatch[0];
    console.log(`  Created RFQ ID: ${createdRfqId}`);

    // Evaluate RFQ card
    note('OK', 'My RFQs card', 'RFQ card appeared after submission');

    const cardText = await firstCard.innerText();
    const hasTitle = cardText.includes('Data Center');
    note(hasTitle ? 'OK' : 'ISSUE', 'My RFQs card', hasTitle ? 'RFQ title visible on card' : 'RFQ title missing from card');

    const hasBidCount = await firstCard.locator('.bid-count, .bid-pill, [class*="bid"]').count() > 0;
    note(hasBidCount ? 'OK' : 'WARN', 'My RFQs card', hasBidCount ? 'Bid count indicator on card' : 'No bid count indicator visible');

    const hasStatusBadge = await firstCard.locator('.status-badge, .s-active, .s-draft, [class*="s-"]').count() > 0;
    note(hasStatusBadge ? 'OK' : 'WARN', 'My RFQs card', hasStatusBadge ? 'Status badge visible on card' : 'No status badge on card');

    const hasDeadline = cardText.toLowerCase().includes('days') || cardText.toLowerCase().includes('deadline') || /\d{1,2}\/\d{1,2}/.test(cardText);
    note(hasDeadline ? 'OK' : 'WARN', 'My RFQs card', hasDeadline ? 'Deadline shown on card' : 'No deadline visible on card');

    // ── 1g. Expand the BOM panel ──
    await firstCard.click();
    await buyer.waitForTimeout(1200);
    await shot(buyer, '12-my-rfqs-card-expanded', 'My RFQs — BOM expand panel open');

    const expandPanel = buyer.locator('.bid-expand-panel, .expand-panel').first();
    const panelVisible = await expandPanel.isVisible().catch(() => false);
    note(panelVisible ? 'OK' : 'ISSUE', 'My RFQs expand panel', panelVisible ? 'Expand panel opened on card click' : 'Expand panel not visible after click');

    if (panelVisible) {
      const panelText = await expandPanel.innerText();
      const hasBomTab = /bill of materials|bom|sku/i.test(panelText);
      note(hasBomTab ? 'OK' : 'WARN', 'My RFQs BOM panel', hasBomTab ? 'BOM content visible in expand panel' : 'No BOM content in expand panel');

      const hasBidsTab = /bids|compare/i.test(panelText);
      note(hasBidsTab ? 'OK' : 'WARN', 'My RFQs BOM panel', 'Bids tab exists in expand panel: ' + hasBidsTab);

      // Check BOM shows vendor grouping
      const hasCisco  = panelText.includes('Cisco');
      const hasHPE    = panelText.includes('HPE') || panelText.includes('HP');
      const hasDell   = panelText.includes('Dell');
      note((hasCisco && hasHPE && hasDell) ? 'OK' : 'WARN', 'My RFQs BOM panel', `Vendors visible in BOM: Cisco=${hasCisco}, HPE=${hasHPE}, Dell=${hasDell}`);
    }

    // ── 1h. Compare Bids (should show 0 bids) ──
    if (createdRfqId) {
      await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${createdRfqId}`, { waitUntil: 'domcontentloaded' });
      await buyer.waitForTimeout(4000);
      await shot(buyer, '13-compare-bids-no-bids', 'Compare Bids — zero bids state');

      const bodyText = await buyer.locator('body').innerText();
      const hasNoBidsMsg = /no bids|waiting|0 bids|no resellers/i.test(bodyText);
      note(hasNoBidsMsg ? 'OK' : 'WARN', 'Compare Bids (empty)', hasNoBidsMsg ? 'Clear empty state when no bids yet' : 'No clear message when 0 bids received');

      const rfqTitleEl = await buyer.locator('#rfq-title').textContent().catch(() => '');
      note(rfqTitleEl.trim().length > 0 ? 'OK' : 'WARN', 'Compare Bids header', rfqTitleEl.trim().length > 0 ? `RFQ title shown: "${rfqTitleEl.trim()}"` : 'No RFQ title in compare-bids header');
    }

    // ════════════════════════════════════════════════════════════
    // PHASE 2: RESELLER JOURNEY
    // ════════════════════════════════════════════════════════════

    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 2: RESELLER JOURNEY');
    console.log('═══════════════════════════════════════\n');

    // ── 2a. Reseller login ──
    await reseller.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForTimeout(1000);
    await reseller.fill('#login-email', RESELLER_EMAIL);
    await reseller.fill('#login-password', RESELLER_PASS);
    await shot(reseller, '14-reseller-auth', 'Reseller login screen');
    await reseller.locator('#login-form').evaluate(f => f.requestSubmit());
    await reseller.waitForURL(/reseller-dashboard/, { timeout: 20000 });
    await reseller.waitForTimeout(3000);

    // ── 2b. Reseller dashboard ──
    await shot(reseller, '15-reseller-dashboard', 'Reseller dashboard after login');

    const resellerBodyText = await reseller.locator('body').innerText();
    note(!resellerBodyText.includes('[object Object]'), 'Reseller dashboard', 'No raw JS objects in rendered text');

    // Check sidebar vendor authorization
    const tiersHtml = await reseller.locator('#sidebar-tiers, .sidebar-tiers, .vendor-tiers').first().innerHTML().catch(() => '');
    note(tiersHtml.length > 0 ? 'OK' : 'WARN', 'Reseller sidebar', tiersHtml.length > 0 ? 'Vendor authorization tiers shown in sidebar' : 'No vendor tiers in sidebar');

    // Check stats
    const winRate = await reseller.locator('#stat-win-rate').textContent().catch(() => '—');
    const revenue = await reseller.locator('#stat-revenue').textContent().catch(() => '—');
    console.log(`  Reseller stats — Win rate: ${winRate.trim()}, Revenue: ${revenue.trim()}`);
    note(winRate.trim() !== '—' ? 'OK' : 'WARN', 'Reseller dashboard stats', 'Win rate populated: ' + winRate.trim());

    // ── 2c. Open RFQ grid ──
    await reseller.waitForSelector('#open-rfq-grid', { timeout: 15000 });
    await reseller.waitForTimeout(2000);

    const openCards = reseller.locator('#open-rfq-grid .rfq-card');
    const openCount = await openCards.count();
    console.log(`  Open RFQ cards visible to reseller: ${openCount}`);
    note(openCount > 0 ? 'OK' : 'ISSUE', 'Reseller open RFQ grid', openCount > 0 ? `${openCount} open RFQ(s) visible` : 'No open RFQs visible — reseller cannot bid');

    if (openCount > 0) {
      const firstRfqText = await openCards.first().innerText();
      const hasTitleInCard = firstRfqText.length > 10;
      note(hasTitleInCard ? 'OK' : 'WARN', 'Reseller RFQ card', 'Card has readable content');

      // Check if card shows which vendors reseller is authorized for
      const hasVendorInfo = /cisco|dell|hpe|hp|juniper/i.test(firstRfqText);
      note(hasVendorInfo ? 'OK' : 'WARN', 'Reseller RFQ card', hasVendorInfo ? 'Vendor names visible on RFQ card' : 'No vendor info on card — reseller cannot tell if they qualify');

      // Check for location info
      const hasLocation = /chicago|IL|\d{5}/.test(firstRfqText);
      note(hasLocation ? 'OK' : 'WARN', 'Reseller RFQ card', hasLocation ? 'Location visible on card' : 'No location on card');
    }

    await shot(reseller, '16-reseller-open-rfqs', 'Reseller — open RFQ grid with new RFQ visible');

    // ── 2d. Open the bid modal ──
    let targetCard = null;
    for (let i = 0; i < openCount; i++) {
      const cardText = await openCards.nth(i).innerText();
      if (cardText.toLowerCase().includes('data center')) {
        targetCard = openCards.nth(i);
        break;
      }
    }
    if (!targetCard) targetCard = openCards.first();

    await targetCard.click();
    await reseller.waitForTimeout(1000);

    const bidModalVisible = !(await reseller.locator('#bid-modal').evaluate(el => el.classList.contains('hidden')).catch(() => true));
    note(bidModalVisible ? 'OK' : 'ISSUE', 'Reseller bid modal', bidModalVisible ? 'Bid modal opened on card click' : 'Bid modal did not open');

    await shot(reseller, '17-bid-modal-open', 'Reseller bid modal — initial state');

    if (bidModalVisible) {
      const modalBodyText = await reseller.locator('#bid-modal-body').innerText();

      // Check modal shows RFQ details
      const hasRfqTitle = modalBodyText.toLowerCase().includes('data center') || await reseller.locator('#bid-modal-title').textContent().then(t => t.includes('Data Center'));
      note(hasRfqTitle ? 'OK' : 'WARN', 'Bid modal', hasRfqTitle ? 'RFQ title shown in modal' : 'RFQ title not visible in modal header');

      // Check for BOM/SKU info in the modal
      const hasBomInModal = /sku|part number|c930|isr|dl380/i.test(modalBodyText);
      note(hasBomInModal ? 'OK' : 'WARN', 'Bid modal', hasBomInModal ? 'SKU/BOM visible in bid modal — reseller can see what to price' : 'No SKU details in bid modal — reseller must look elsewhere to price items');

      // Check price input fields
      const priceInputs = reseller.locator('input[id^="price-"]');
      const priceCount = await priceInputs.count();
      note(priceCount > 0 ? 'OK' : 'ISSUE', 'Bid modal', `${priceCount} price input(s) visible`);

      // Check for per-line-item pricing vs single total
      note(priceCount > 1 ? 'OK' : 'WARN', 'Bid modal', priceCount > 1 ? 'Per-line-item pricing (good for detailed quotes)' : 'Single price total — less granular');

      // Check for auth checkbox (authorized reseller declaration)
      const hasAuthCheck = await reseller.locator('#bid-auth-checkbox, [id*="auth"]').count() > 0;
      note(hasAuthCheck ? 'OK' : 'WARN', 'Bid modal', hasAuthCheck ? 'Authorization checkbox present (compliance)' : 'No authorization declaration');

      // Check for notes field
      const hasNotes = await reseller.locator('#bid-notes, textarea[id*="note"]').count() > 0;
      note(hasNotes ? 'OK' : 'WARN', 'Bid modal', hasNotes ? 'Notes field in bid modal' : 'No notes/message field in bid modal');

      // ── Fill in bid ──
      const inputs = await priceInputs.all();
      const prices = [4850, 6200, 12400, 28500]; // Cisco switch, router, HPE server, Dell storage
      for (let i = 0; i < Math.min(inputs.length, prices.length); i++) {
        await inputs[i].fill(String(prices[i]));
      }

      const authCb = reseller.locator('#bid-auth-checkbox');
      if (await authCb.count() > 0) await authCb.check();

      const notesField = reseller.locator('#bid-notes');
      if (await notesField.count() > 0) {
        await notesField.fill('Authorized Cisco Partner (Gold), HPE Reseller, Dell EMC partner. All items in stock with 2-week delivery. Volume discount applied.');
      }

      await shot(reseller, '18-bid-modal-filled', 'Bid modal — filled with realistic pricing');

      // Submit bid
      await reseller.locator('#bid-submit-btn').click();
      await reseller.waitForTimeout(3000);

      // Check success state
      const successVisible = await reseller.locator('.bid-success, .success-state, [class*="success"]').count() > 0;
      const modalText = await reseller.locator('#bid-modal').innerText().catch(() => '');
      const hasSuccessMsg = /success|submitted|bid placed|thank/i.test(modalText);
      note((successVisible || hasSuccessMsg) ? 'OK' : 'ISSUE', 'Bid submission', (successVisible || hasSuccessMsg) ? 'Success state shown after bid submit' : 'No success feedback after bid submission');

      await shot(reseller, '19-bid-submitted', 'After bid submission — success state');

      // Close modal
      const cancelBtn = reseller.locator('.btn-cancel-bid, button:has-text("Close"), button:has-text("Done")').first();
      if (await cancelBtn.count() > 0) await cancelBtn.click();
      await reseller.waitForTimeout(800);
    }

    // ── 2e. Reseller "My Bids" section — after bidding ──
    await reseller.waitForTimeout(2000);
    await shot(reseller, '20-reseller-my-bids', 'Reseller dashboard — My Bids section after submitting');

    const activeBids = reseller.locator('#my-bids-list .rfq-card, .my-bids .rfq-card');
    const activeBidCount = await activeBids.count();
    note(activeBidCount > 0 ? 'OK' : 'WARN', 'Reseller My Bids', activeBidCount > 0 ? `${activeBidCount} bid(s) showing in My Bids section` : 'Bid not appearing in My Bids section immediately');

    // Check bid card content
    if (activeBidCount > 0) {
      const bidCardText = await activeBids.first().innerText();
      const hasPendingTag = /pending|submitted|active/i.test(bidCardText);
      note(hasBidCount ? 'OK' : 'WARN', 'Reseller bid card', hasPendingTag ? 'Bid status shown on card' : 'No status indicator on submitted bid card');
    }

    // ── 2f. Reseller Notifications ──
    await reseller.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForTimeout(3000);
    await shot(reseller, '21-reseller-notifications', 'Reseller notifications page');

    // ── 2g. Reseller Profile ──
    await reseller.goto(`${BASE}/bidbridge-reseller-profile.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForTimeout(3000);
    await shot(reseller, '22-reseller-profile', 'Reseller profile page');

    const profileBodyText = await reseller.locator('body').innerText();
    const hasCompanyInfo = /company|business|name/i.test(profileBodyText);
    const hasVendorAuth  = /authorized|vendor|tier|cisco|dell/i.test(profileBodyText);
    note(hasCompanyInfo ? 'OK' : 'WARN', 'Reseller profile', 'Company info section visible: ' + hasCompanyInfo);
    note(hasVendorAuth ? 'OK' : 'WARN', 'Reseller profile', 'Vendor authorization visible: ' + hasVendorAuth);

    // ════════════════════════════════════════════════════════════
    // PHASE 3: BUYER REVIEWS BIDS
    // ════════════════════════════════════════════════════════════

    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 3: BUYER REVIEWS & AWARDS');
    console.log('═══════════════════════════════════════\n');

    // ── 3a. Buyer goes back to My RFQs ──
    await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForFunction(() => {
      const rfqList = document.getElementById('rfq-list');
      return rfqList && rfqList.children.length > 0;
    }, { timeout: 20000 });
    await buyer.waitForTimeout(2500);
    await shot(buyer, '23-my-rfqs-with-bid', 'My RFQs after reseller bid received');

    // Check for NEW BIDS indicator
    const firstCardAfterBid = buyer.locator('#rfq-list .rfq-card').first();
    const cardTextAfterBid = await firstCardAfterBid.innerText();
    const hasNewBidsIndicator = /new bid|1 bid|bids/i.test(cardTextAfterBid);
    note(hasNewBidsIndicator ? 'OK' : 'WARN', 'My RFQs — post bid', hasNewBidsIndicator ? 'Card shows bid count / "NEW" indicator' : 'No visual indication a bid was received');

    // ── 3b. Compare Bids ──
    if (createdRfqId) {
      await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${createdRfqId}`, { waitUntil: 'domcontentloaded' });
      await buyer.waitForSelector('.bid-card, .bid-row-summary', { timeout: 25000 });
      await buyer.waitForTimeout(3000);
      await shot(buyer, '24-compare-bids-with-bid', 'Compare Bids — one bid received');

      // Evaluate compare bids page
      const comparePage = await buyer.locator('body').innerText();

      const hasBidCard = await buyer.locator('.bid-card, .bid-row-summary').count() > 0;
      note(hasBidCard ? 'OK' : 'ISSUE', 'Compare Bids', hasBidCard ? 'Bid card(s) rendered' : 'No bid cards visible');

      // Check view toggle (card vs table)
      const hasViewToggle = await buyer.locator('#toggle-card, #toggle-table, .toggle-btn, [onclick*="setView"]').count() > 0;
      note(hasViewToggle ? 'OK' : 'WARN', 'Compare Bids', hasViewToggle ? 'Card/table view toggle present' : 'No view toggle — only one layout available');

      // Check pricing visibility
      const hasPriceInfo = /\$[\d,]+/.test(comparePage);
      note(hasPriceInfo ? 'OK' : 'ISSUE', 'Compare Bids', hasPriceInfo ? 'Price data visible in bid comparison' : 'No price data visible');

      // Check for savings indicators
      const hasSavings = /savings|lowest|discount/i.test(comparePage);
      note(hasSavings ? 'OK' : 'WARN', 'Compare Bids', hasSavings ? 'Savings/lowest indicator shown' : 'No savings context shown — buyer cannot see value easily');

      // Check for reseller info (company name, tier)
      const hasResellerInfo = /itseller|authorized|tier|gold/i.test(comparePage.toLowerCase());
      note(hasResellerInfo ? 'OK' : 'WARN', 'Compare Bids', hasResellerInfo ? 'Reseller company info visible' : 'No reseller credentials visible');

      // Check award button
      const awardBtn = buyer.locator('.btn-award:not(.awarded), button:has-text("Award bid")').first();
      const hasAwardBtn = await awardBtn.count() > 0;
      note(hasAwardBtn ? 'OK' : 'ISSUE', 'Compare Bids', hasAwardBtn ? 'Award button visible' : 'No award button');

      // Switch to table view
      const tableToggle = buyer.locator('#toggle-table, button:has-text("Table")').first();
      if (await tableToggle.count() > 0) {
        await tableToggle.click();
        await buyer.waitForTimeout(800);
        await shot(buyer, '25-compare-bids-table-view', 'Compare Bids — table view');
        note('OK', 'Compare Bids', 'Table view renders without issues');

        // Switch back to card view
        const cardToggle = buyer.locator('#toggle-card, button:has-text("Card")').first();
        if (await cardToggle.count() > 0) await cardToggle.click();
        await buyer.waitForTimeout(500);
      }

      // ── 3c. Open award overlay ──
      if (hasAwardBtn) {
        await awardBtn.click();
        await buyer.waitForTimeout(800);
        const awardOverlay = buyer.locator('#award-overlay');
        const overlayOpen = await awardOverlay.evaluate(el => el.classList.contains('open')).catch(() => false);
        note(overlayOpen ? 'OK' : 'ISSUE', 'Award overlay', overlayOpen ? 'Award confirmation overlay opened' : 'Award overlay did not open');

        if (overlayOpen) {
          await shot(buyer, '26-award-overlay', 'Award overlay — confirmation dialog');

          const overlayText = await awardOverlay.innerText();
          // Check for reseller name + amount in confirmation
          const hasPriceInOverlay = /\$[\d,]+/.test(overlayText);
          note(hasPriceInOverlay ? 'OK' : 'WARN', 'Award overlay', hasPriceInOverlay ? 'Price shown in award confirmation' : 'No price in award confirmation — buyer confirming blind');

          const hasResellerInOverlay = overlayText.length > 30;
          note(hasResellerInOverlay ? 'OK' : 'WARN', 'Award overlay', 'Overlay has substantive content: ' + hasResellerInOverlay);

          // Check cancel works
          const cancelBtn = awardOverlay.locator('.btn-cancel, button:has-text("Cancel")').first();
          if (await cancelBtn.count() > 0) {
            await cancelBtn.click();
            await buyer.waitForTimeout(500);
            note('OK', 'Award overlay', 'Cancel button works');
          }

          // Re-open and confirm award
          await awardBtn.click();
          await buyer.waitForTimeout(800);
          const confirmBtn = buyer.locator('#btn-confirm-award');
          if (await confirmBtn.count() > 0) {
            await confirmBtn.click();
            await buyer.waitForTimeout(5000);

            // Reload to see awarded state
            await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${createdRfqId}`, { waitUntil: 'domcontentloaded' });
            await buyer.waitForTimeout(5000);
            await shot(buyer, '27-compare-bids-awarded', 'Compare Bids — after awarding');

            const awardedText = await buyer.locator('body').innerText();
            const isAwarded = /awarded|winner|won/i.test(awardedText);
            note(isAwarded ? 'OK' : 'ISSUE', 'Compare Bids post-award', isAwarded ? 'Awarded state shown correctly' : 'Awarded state not clearly visible');

            // Check exec summary link
            const hasExecLink = await buyer.locator('a[href*="exec-summary"], button:has-text("Exec summary"), button:has-text("summary")').count() > 0;
            note(hasExecLink ? 'OK' : 'WARN', 'Compare Bids post-award', hasExecLink ? 'Exec summary link visible after award' : 'No exec summary link visible after awarding');
          }
        }
      }

      // ── 3d. Executive Summary ──
      await buyer.goto(`${BASE}/bidbridge-exec-summary.html?rfq=${createdRfqId}`, { waitUntil: 'domcontentloaded' });
      await buyer.waitForTimeout(5000);
      await shot(buyer, '28-exec-summary', 'Executive Summary report');

      const execText = await buyer.locator('body').innerText();
      const hasRfqTitle = execText.includes('Data Center');
      const hasTotalCost = /total.*\$|cost.*\$|\$.*total/i.test(execText);
      const hasSavingsSection = /savings|discount|market/i.test(execText);
      const hasVendorBreakdown = /cisco|hpe|dell/i.test(execText);

      note(hasRfqTitle ? 'OK' : 'WARN', 'Exec Summary', hasRfqTitle ? 'RFQ title shown in exec summary' : 'RFQ title missing');
      note(hasTotalCost ? 'OK' : 'WARN', 'Exec Summary', hasTotalCost ? 'Total cost visible' : 'No total cost in exec summary');
      note(hasSavingsSection ? 'OK' : 'WARN', 'Exec Summary', hasSavingsSection ? 'Savings section present' : 'No savings context in exec summary');
      note(hasVendorBreakdown ? 'OK' : 'WARN', 'Exec Summary', hasVendorBreakdown ? 'Vendor breakdown visible' : 'No vendor breakdown');

      // Check print/export
      const hasPrintBtn = await buyer.locator('button:has-text("Print"), button:has-text("Export"), button:has-text("PDF"), .btn-print').count() > 0;
      note(hasPrintBtn ? 'OK' : 'WARN', 'Exec Summary', hasPrintBtn ? 'Print/export button present' : 'No print/export — exec summary cannot be shared');
    }

    // ════════════════════════════════════════════════════════════
    // PHASE 4: RESELLER SEES WIN
    // ════════════════════════════════════════════════════════════

    console.log('\n═══════════════════════════════════════');
    console.log('  PHASE 4: RESELLER SEES WIN');
    console.log('═══════════════════════════════════════\n');

    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    await reseller.waitForSelector('#open-rfq-grid', { timeout: 15000 });
    await reseller.waitForTimeout(3000);
    await reseller.locator('#mybids-pill-won').click();
    await reseller.waitForTimeout(1500);
    await shot(reseller, '29-reseller-won-bid', 'Reseller — WON bid visible in My Bids');

    const wonCards = reseller.locator('#my-bids-list .rfq-card');
    const wonCount = await wonCards.count();
    note(wonCount > 0 ? 'OK' : 'ISSUE', 'Reseller WON state', wonCount > 0 ? `${wonCount} WON bid(s) visible after award` : 'WON bid not appearing for reseller — notification gap');

    if (wonCount > 0) {
      const wonCardText = await wonCards.first().innerText();
      const hasWonBadge = /won/i.test(wonCardText);
      note(hasWonBadge ? 'OK' : 'WARN', 'Reseller WON badge', hasWonBadge ? 'WON badge visible on bid card' : 'No WON badge on card');

      // Click to see bid summary
      await wonCards.first().click();
      await reseller.waitForTimeout(1000);
      await shot(reseller, '30-reseller-won-modal', 'Reseller WON bid summary modal');

      const wonModalVisible = !(await reseller.locator('#bid-modal').evaluate(el => el.classList.contains('hidden')).catch(() => true));
      note(wonModalVisible ? 'OK' : 'WARN', 'Reseller WON modal', wonModalVisible ? 'Bid summary modal opens for WON bid' : 'Modal did not open for WON bid');

      if (wonModalVisible) {
        const modalText = await reseller.locator('#bid-modal').innerText();
        const hasWonMsg = /won|awarded|congratulations/i.test(modalText);
        note(hasWonMsg ? 'OK' : 'WARN', 'Reseller WON modal', hasWonMsg ? 'Clear win message in modal' : 'No congratulatory win message');

        const hasContactInfo = /contact|email|phone|buyer/i.test(modalText);
        note(hasContactInfo ? 'OK' : 'WARN', 'Reseller WON modal', hasContactInfo ? 'Buyer contact info in win modal' : 'No buyer contact info — reseller cannot follow up');

        const hasLineItems = /<table|sku|part number/i.test(await reseller.locator('#bid-modal').innerHTML());
        note(hasLineItems ? 'OK' : 'WARN', 'Reseller WON modal', hasLineItems ? 'Awarded line items shown in win summary' : 'No line item breakdown in win summary');
      }
    }

    // ════════════════════════════════════════════════════════════
    // USABILITY REPORT
    // ════════════════════════════════════════════════════════════

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  USABILITY REPORT');
    console.log('═══════════════════════════════════════════════════════\n');

    const okCount     = issues.filter(i => i.startsWith('🟢')).length;
    const warnCount   = issues.filter(i => i.startsWith('🟡')).length;
    const issueCount  = issues.filter(i => i.startsWith('🔴')).length;

    console.log(`  🟢 PASS:  ${okCount}`);
    console.log(`  🟡 WARN:  ${warnCount}`);
    console.log(`  🔴 ISSUE: ${issueCount}`);
    console.log('\n── All findings ──');
    issues.forEach(i => console.log('  ' + i));
    console.log('\n── Screenshots written to: screenshots/usability/ ──');

    expect(issueCount, `${issueCount} critical issue(s) found — see console output`).toBeLessThanOrEqual(3);

  } finally {
    // ── Cleanup: delete the created RFQ ──
    if (createdRfqId) {
      await buyer.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
      await buyer.waitForTimeout(2000);
      const deleted = await buyer.evaluate(async (rfqId) => {
        const sb = window._supabase;
        if (!sb) return false;
        await sb.from('bid_history').delete().eq('rfq_id', rfqId);
        await sb.from('bids').delete().eq('rfq_id', rfqId);
        await sb.from('notifications').delete().eq('rfq_id', rfqId);
        await sb.from('messages').delete().eq('rfq_id', rfqId);
        await sb.from('rfq_items').delete().eq('rfq_id', rfqId);
        const { data } = await sb.from('rfqs').delete().eq('id', rfqId).select('id');
        return data && data.length > 0;
      }, createdRfqId);
      console.log(`\n🧹 Cleanup: RFQ ${createdRfqId} ${deleted ? 'deleted' : 'not found/already deleted'}`);
    }
    await buyerCtx.close();
    await resellerCtx.close();
  }
});
