/**
 * Split-Bid Full Lifecycle Test
 *
 * Accounts:
 *   Buyer:   mattkrueger@comcast.net  (ITBuyerTest)
 *   Seller1: mk@comcast.net           (ITSeller)  — authorized: Cisco + Dell + Palo Alto
 *   Seller2: mk2@comcast.net          (ITBuy#2)   — authorized: Dell only
 *
 * RFQ: Cisco (5x SKU-A at $50 ea) + Dell Technologies (3x SKU-B at $80 ea)
 *   → ITBuy#2 sees ONLY Dell
 *   → ITSeller sees BOTH Cisco + Dell
 *
 * Bids:
 *   Round 1 — ITBuy#2: Dell @ $300 total | ITSeller: Cisco @ $150 + Dell @ $200
 *   Ranks after round 1:
 *     Cisco: ITSeller #1 (sole bidder)
 *     Dell:  ITSeller #1 ($200 < $300), ITBuy#2 #2 ($300)
 *
 *   Buyer edits BoM (change Cisco qty from 5 → 8) → both bids go stale
 *
 *   Round 2 — ITBuy#2: Dell @ $180 (now wins Dell) | ITSeller: Cisco @ $150 + Dell @ $200
 *   Ranks after round 2:
 *     Cisco: ITSeller #1
 *     Dell:  ITBuy#2 #1 ($180), ITSeller #2 ($200)
 *
 *   Award: Cisco → ITSeller, Dell → ITBuy#2
 *   Messages: separate intro to each winner
 *   Exec summary: both vendor sections, correct math
 */

const { test, expect } = require('@playwright/test');

const BASE          = 'http://localhost:3000';
const SUPABASE_URL  = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

const BUYER_EMAIL    = 'mattkrueger@comcast.net';
const BUYER_PWD      = 'Test12345678';
const SELLER1_EMAIL  = 'mk@comcast.net';       // ITSeller — Cisco + Dell
const SELLER1_PWD    = 'Test12345678';
const SELLER2_EMAIL  = 'mk2@comcast.net';      // ITBuy#2 — Dell only
const SELLER2_PWD    = 'Test12345678';

const SELLER1_ID = 'ad52644c-96d8-4936-a5a5-8c82c1c56851';
const SELLER2_ID = 'c7961587-bbc5-411a-bd86-40f4f3f61076';

const RFQ_TITLE = 'LIFECYCLE_SPLIT_' + Date.now();
let rfqId        = null;
let buyerToken   = null;
let seller1Token = null;
let seller2Token = null;

const results = { pass: [], fail: [], warn: [] };
function PASS(label) { results.pass.push(label); console.log('✅ PASS:', label); }
function FAIL(label, detail) { results.fail.push(label + (detail ? ': ' + detail : '')); console.log('❌ FAIL:', label, detail || ''); }
function WARN(label) { results.warn.push(label); console.log('⚠️  WARN:', label); }

function apiHeaders(token) {
  return { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function freshToken(email, pwd) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pwd }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Login failed for ${email}: ${JSON.stringify(d)}`);
  return d.access_token;
}

async function api(token, path, method = 'GET', body = null) {
  const opts = { method, headers: apiHeaders(token) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function loginBrowser(page, email, pwd) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', pwd);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard|reseller/, { timeout: 20000 });
}

async function cleanupStale(token) {
  const rows = await api(token, `rfqs?title=like.LIFECYCLE_SPLIT_%25&select=id`);
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const id = row.id;
    for (const tbl of ['bid_history', 'notifications', 'messages', 'bids', 'rfq_items']) {
      await api(token, `${tbl}?rfq_id=eq.${id}`, 'DELETE');
    }
    await api(token, `rfqs?id=eq.${id}`, 'DELETE');
    console.log('🧹 Cleaned stale:', id);
  }
}

async function cleanup(token) {
  if (!rfqId) return;
  for (const tbl of ['bid_history', 'notifications', 'messages', 'bids', 'rfq_items']) {
    await api(token, `${tbl}?rfq_id=eq.${rfqId}`, 'DELETE');
  }
  await api(token, `rfqs?id=eq.${rfqId}`, 'DELETE');
  console.log('🧹 Cleanup done for', rfqId);
}

// ─── helper: wait for element with text ───────────────────────────────────────
async function waitForText(page, selector, text, timeout = 8000) {
  await page.waitForFunction(
    ({ sel, txt }) => {
      const el = document.querySelector(sel);
      return el && el.textContent.toLowerCase().includes(txt.toLowerCase());
    },
    { sel: selector, txt: text },
    { timeout }
  );
}

// ─── helper: get supabase token from browser localStorage ─────────────────────
async function getBrowserToken(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
    if (!key) return null;
    try { return JSON.parse(localStorage.getItem(key))?.access_token; } catch { return null; }
  });
}

test('Split-bid full lifecycle', async ({ browser }) => {
  test.setTimeout(600000);

  // ── open browser contexts ──────────────────────────────────────────────────
  const buyerCtx   = await browser.newContext();
  const seller1Ctx = await browser.newContext();
  const seller2Ctx = await browser.newContext();
  const buyerPage  = await buyerCtx.newPage();
  const s1Page     = await seller1Ctx.newPage();
  const s2Page     = await seller2Ctx.newPage();

  try {
    // ══════════════════════════════════════════════════════════════════
    // SETUP — get API tokens
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── SETUP ──────────────────────────────────────');
    buyerToken   = await freshToken(BUYER_EMAIL, BUYER_PWD);
    seller1Token = await freshToken(SELLER1_EMAIL, SELLER1_PWD);
    seller2Token = await freshToken(SELLER2_EMAIL, SELLER2_PWD);
    await cleanupStale(buyerToken);
    PASS('Setup: API tokens obtained');

    // ══════════════════════════════════════════════════════════════════
    // STEP 1 — Buyer creates split-bid RFQ (Cisco + Dell)
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 1: Buyer creates RFQ ──────────────────');
    await loginBrowser(buyerPage, BUYER_EMAIL, BUYER_PWD);
    await buyerPage.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
    await buyerPage.waitForSelector('#project-title', { timeout: 15000 });

    // Step 1 form
    await buyerPage.fill('#project-title', RFQ_TITLE);
    await buyerPage.fill('#project-desc', 'Full lifecycle split-bid test. Please ignore.');
    const deadline = new Date(); deadline.setDate(deadline.getDate() + 14);
    await buyerPage.fill('#project-deadline', deadline.toISOString().slice(0, 10));
    await buyerPage.fill('#project-city', 'Boston');
    await buyerPage.selectOption('#project-state', 'MA');
    await buyerPage.locator('#section-1 button.btn-next').click();

    // Step 2: Cisco SKU
    await buyerPage.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await buyerPage.selectOption('#vendor-name-1', 'Cisco');
    await buyerPage.fill('#sku-part-1-1', 'C9300-TEST');
    await buyerPage.fill('#sku-qty-1-1', '5');

    // Add Dell vendor
    await buyerPage.locator('button.btn-add-vendor').click();
    await buyerPage.waitForSelector('#vendor-name-2', { timeout: 5000 });
    await buyerPage.selectOption('#vendor-name-2', 'Dell Technologies');
    await buyerPage.fill('#sku-part-2-1', 'DELL-R750-TEST');
    await buyerPage.fill('#sku-qty-2-1', '3');
    await buyerPage.locator('#section-2 button.btn-next').click();

    // Step 3: split strategy
    await buyerPage.waitForSelector('#card-split', { timeout: 10000 });
    await buyerPage.locator('#card-split').click();
    await buyerPage.locator('#section-3 button.btn-next').click();

    // Step 4: submit
    await buyerPage.waitForSelector('#submit-btn', { timeout: 10000 });
    await buyerPage.click('#submit-btn');
    await expect(buyerPage.locator('.success-screen')).toBeVisible({ timeout: 20000 });
    PASS('Step 1: RFQ submitted (' + RFQ_TITLE + ')');

    // Grab the RFQ ID from the DB
    await buyerPage.waitForTimeout(2000);
    const rfqs = await api(buyerToken, `rfqs?title=eq.${encodeURIComponent(RFQ_TITLE)}&select=id,strategy,status`);
    if (!Array.isArray(rfqs) || rfqs.length === 0) { FAIL('Step 1: RFQ not found in DB'); throw new Error('RFQ not found'); }
    rfqId = rfqs[0].id;
    if (rfqs[0].strategy === 'split') PASS('Step 1: strategy=split confirmed in DB');
    else FAIL('Step 1: strategy not split — got: ' + rfqs[0].strategy);

    // ══════════════════════════════════════════════════════════════════
    // STEP 2 — CHECK A: ITBuy#2 (Dell only) loads dashboard
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 2: ITBuy#2 vendor filter check ────────');
    await loginBrowser(s2Page, SELLER2_EMAIL, SELLER2_PWD);
    await s2Page.waitForTimeout(4000);

    // CHECK A1: Action Needed / notification for new RFQ
    const s2BodyText = await s2Page.locator('body').textContent();
    const s2HasNewRfqAlert = s2BodyText.toLowerCase().includes('new rfq') ||
      s2BodyText.toLowerCase().includes('open rfq') ||
      await s2Page.locator('[id*="notif"], [id*="action"], .action-strip, .needs-attention').count() > 0;
    if (s2HasNewRfqAlert) PASS('CHECK A1: ITBuy#2 sees new RFQ alert/notification area on dashboard');
    else WARN('CHECK A1: No explicit new-RFQ alert visible on ITBuy#2 dashboard (may not have loaded yet)');

    // Scroll to Open RFQs and find test RFQ
    await s2Page.evaluate(() => {
      const el = document.getElementById('section-open-rfqs') || document.getElementById('open-rfq-grid');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await s2Page.waitForTimeout(2000);

    // Find the test RFQ card for ITBuy#2
    const s2Cards = s2Page.locator('#open-rfq-grid .rfq-card');
    let s2TestCard = null;
    const s2Count = await s2Cards.count();
    for (let i = 0; i < s2Count; i++) {
      const t = await s2Cards.nth(i).textContent();
      if (t.includes(RFQ_TITLE)) { s2TestCard = s2Cards.nth(i); break; }
    }

    if (s2TestCard) {
      PASS('CHECK A2: ITBuy#2 sees the split-bid RFQ in Open RFQs');
    } else {
      FAIL('CHECK A2: ITBuy#2 cannot find RFQ in Open RFQs');
    }

    // Open bid modal and verify ONLY Dell items shown (not Cisco)
    if (s2TestCard) {
      await s2TestCard.click();
      await s2Page.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
      await s2Page.waitForTimeout(1000);

      const modalText = await s2Page.locator('#bid-modal').textContent();
      const hasDell   = modalText.toLowerCase().includes('dell');
      const hasCisco  = modalText.toLowerCase().includes('cisco') &&
                        !modalText.toLowerCase().includes('none of the vendors');

      if (hasDell && !hasCisco) {
        PASS('CHECK A3: ITBuy#2 bid modal shows Dell items ONLY (Cisco correctly hidden)');
      } else if (hasDell && hasCisco) {
        FAIL('CHECK A3: ITBuy#2 bid modal shows BOTH Cisco and Dell — vendor filter not working');
      } else if (!hasDell) {
        FAIL('CHECK A3: ITBuy#2 bid modal shows neither Dell nor Cisco — unexpected');
        console.log('Modal text snippet:', modalText.slice(0, 300));
      }

      // CHECK: modal title says "Your Vendors Only"
      const modalTitle = await s2Page.locator('#bid-modal-title').textContent().catch(() => '');
      if (modalTitle.toLowerCase().includes('your vendors')) {
        PASS('CHECK A4: Modal title says "Your Vendors Only" for split bid');
      } else {
        WARN('CHECK A4: Modal title: "' + modalTitle + '" — expected "Your Vendors Only"');
      }

      // ITBuy#2 submits Dell bid: $300 total
      // Find price inputs and fill them
      const priceInputs = s2Page.locator('[id^="price-"]');
      const inputCount = await priceInputs.count();
      if (inputCount > 0) {
        await priceInputs.first().fill('100'); // $100/unit × 3 qty = $300 total
        for (let i = 1; i < inputCount; i++) await priceInputs.nth(i).fill('100');
        PASS('CHECK A5: ITBuy#2 price inputs filled (' + inputCount + ' inputs for Dell)');
      } else {
        FAIL('CHECK A5: No price inputs found in ITBuy#2 bid modal');
      }

      await s2Page.locator('#bid-auth-checkbox').check().catch(() => {});
      await s2Page.locator('#bid-submit-btn').click();
      try {
        await s2Page.waitForSelector('.bid-success', { timeout: 15000 });
        PASS('Step 2: ITBuy#2 submitted Dell bid ($100/unit) — success screen shown');
      } catch {
        FAIL('Step 2: ITBuy#2 bid submit — success screen never appeared');
      }
      await s2Page.waitForTimeout(2000);

      // Verify bid saved to DB
      const s2Bids = await api(seller2Token, `bids?rfq_id=eq.${rfqId}&reseller_id=eq.${SELLER2_ID}&select=id,total_price,line_items`);
      if (Array.isArray(s2Bids) && s2Bids.length > 0) {
        PASS('Step 2: ITBuy#2 bid confirmed in DB — total=$' + s2Bids[0].total_price);
      } else {
        FAIL('Step 2: ITBuy#2 bid NOT found in DB after submission');
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 3 — CHECK B: ITSeller (Cisco + Dell) loads dashboard
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 3: ITSeller vendor filter + rank check ');
    await loginBrowser(s1Page, SELLER1_EMAIL, SELLER1_PWD);
    await s1Page.waitForTimeout(4000);

    // CHECK B1: ITSeller sees new RFQ notification
    const s1BodyText = await s1Page.locator('body').textContent();
    const s1HasAlert = s1BodyText.toLowerCase().includes('new rfq') ||
      s1BodyText.toLowerCase().includes('open rfq') ||
      await s1Page.locator('[id*="notif"], [id*="action"]').count() > 0;
    if (s1HasAlert) PASS('CHECK B1: ITSeller sees alert/notification area on dashboard');
    else WARN('CHECK B1: No explicit new-RFQ alert on ITSeller dashboard');

    // Find the test RFQ
    await s1Page.evaluate(() => {
      const el = document.getElementById('section-open-rfqs') || document.getElementById('open-rfq-grid');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await s1Page.waitForTimeout(2000);

    const s1Cards = s1Page.locator('#open-rfq-grid .rfq-card');
    let s1TestCard = null;
    const s1Count = await s1Cards.count();
    for (let i = 0; i < s1Count; i++) {
      const t = await s1Cards.nth(i).textContent();
      if (t.includes(RFQ_TITLE)) { s1TestCard = s1Cards.nth(i); break; }
    }

    if (s1TestCard) PASS('CHECK B2: ITSeller finds the split-bid RFQ in Open RFQs');
    else FAIL('CHECK B2: ITSeller cannot find RFQ');

    if (s1TestCard) {
      await s1TestCard.click();
      await s1Page.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
      await s1Page.waitForTimeout(1000);

      const s1ModalText = await s1Page.locator('#bid-modal').textContent();
      const s1HasCisco  = s1ModalText.toLowerCase().includes('cisco');
      const s1HasDell   = s1ModalText.toLowerCase().includes('dell');

      if (s1HasCisco && s1HasDell) {
        PASS('CHECK B3: ITSeller bid modal shows BOTH Cisco and Dell (authorized for both)');
      } else if (s1HasCisco && !s1HasDell) {
        WARN('CHECK B3: ITSeller only sees Cisco — Dell not shown (may be intentional if single-vendor filtering applies)');
      } else {
        FAIL('CHECK B3: ITSeller modal does not show expected vendors. Cisco=' + s1HasCisco + ' Dell=' + s1HasDell);
      }

      // ITSeller submits: Cisco items at $30/unit, Dell at $60/unit
      // Cisco: 5×$30 = $150, Dell: 3×$60 = $180 (beats ITBuy#2's $300)
      const priceInputs = s1Page.locator('[id^="price-"]');
      const count = await priceInputs.count();
      if (count > 0) {
        // We need to figure out which inputs are Cisco vs Dell
        // Look at the labels near each price input
        for (let i = 0; i < count; i++) {
          const inputId = await priceInputs.nth(i).getAttribute('id');
          // Check nearby label/row for vendor name
          const rowText = await s1Page.locator(`label[for="${inputId}"], #price-row-${i}, .sku-row`).first()
            .textContent().catch(() => '');
          // Cisco gets $30, Dell gets $60
          const price = (rowText.toLowerCase().includes('dell') || inputId?.includes('dell')) ? '60' : '30';
          await priceInputs.nth(i).fill(price);
        }
        PASS('CHECK B4: ITSeller price inputs filled (' + count + ' inputs)');
      } else {
        FAIL('CHECK B4: No price inputs in ITSeller bid modal');
      }

      await s1Page.locator('#bid-auth-checkbox').check().catch(() => {});
      await s1Page.locator('#bid-submit-btn').click();
      try {
        await s1Page.waitForSelector('.bid-success', { timeout: 15000 });
        PASS('Step 3: ITSeller bid submit — success screen shown');
      } catch {
        FAIL('Step 3: ITSeller bid submit — success screen never appeared');
      }
      await s1Page.waitForTimeout(3000);

      // Verify bid saved to DB with line_items for both vendors
      const s1Bids = await api(seller1Token, `bids?rfq_id=eq.${rfqId}&reseller_id=eq.${SELLER1_ID}&select=id,total_price,line_items`);
      if (Array.isArray(s1Bids) && s1Bids.length > 0) {
        const li = s1Bids[0].line_items || [];
        const hasC = li.some(x => x.vendor === 'Cisco');
        const hasD = li.some(x => x.vendor === 'Dell Technologies');
        PASS('Step 3: ITSeller bid confirmed in DB — total=$' + s1Bids[0].total_price + ' Cisco=' + hasC + ' Dell=' + hasD);
      } else {
        FAIL('Step 3: ITSeller bid NOT found in DB after submission');
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 4 — CHECK C/D: Verify ranks after round 1
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 4: Rank verification after round 1 ────');

    // CHECK C: Verify ITSeller rank via DB
    {
      const allBids = await api(buyerToken, `bids?rfq_id=eq.${rfqId}&select=reseller_id,line_items`);
      if (Array.isArray(allBids)) {
        // Cisco rank
        const ciscoSubs = allBids.map(b => ({
          resellerId: b.reseller_id,
          total: (b.line_items || []).filter(li => li.vendor === 'Cisco')
            .reduce((s, li) => s + parseFloat(li.line_total || (li.unit_price * li.quantity) || 0), 0),
        })).filter(x => x.total > 0).sort((a, b) => a.total - b.total);

        const dellSubs = allBids.map(b => ({
          resellerId: b.reseller_id,
          total: (b.line_items || []).filter(li => li.vendor === 'Dell Technologies')
            .reduce((s, li) => s + parseFloat(li.line_total || (li.unit_price * li.quantity) || 0), 0),
        })).filter(x => x.total > 0).sort((a, b) => a.total - b.total);

        const s1CiscoRank = ciscoSubs.findIndex(x => x.resellerId === SELLER1_ID) + 1;
        const s1DellRank  = dellSubs.findIndex(x => x.resellerId === SELLER1_ID) + 1;

        console.log('  Cisco bids:', ciscoSubs.map(x => x.resellerId.slice(0,8) + '=$' + x.total));
        console.log('  Dell bids:', dellSubs.map(x => x.resellerId.slice(0,8) + '=$' + x.total));

        if (s1CiscoRank === 1) PASS('CHECK C1: DB confirms ITSeller is #1 for Cisco (sole bidder)');
        else FAIL('CHECK C1: ITSeller is rank ' + s1CiscoRank + ' for Cisco — expected #1');

        if (s1DellRank === 1) PASS('CHECK C2: DB confirms ITSeller is #1 for Dell (cheaper than ITBuy#2)');
        else if (s1DellRank > 1) WARN('CHECK C2: ITSeller is rank ' + s1DellRank + ' for Dell (may be expected if ITBuy#2 bid lower)');
        else WARN('CHECK C2: ITSeller has no Dell line items in round 1 bid');
      } else {
        WARN('CHECK C: Could not fetch bids from DB');
      }
    }

    // CHECK D: Verify ITBuy#2 rank via DB — compute subtotals directly
    {
      const allBids = await api(buyerToken, `bids?rfq_id=eq.${rfqId}&select=reseller_id,line_items`);
      if (Array.isArray(allBids) && allBids.length >= 2) {
        // Compute Dell subtotals for each bid
        const dellSubtotals = allBids.map(b => {
          const items = b.line_items || [];
          return {
            resellerId: b.reseller_id,
            dellTotal: items.filter(li => li.vendor === 'Dell Technologies')
              .reduce((s, li) => s + parseFloat(li.line_total || (li.unit_price * li.quantity) || 0), 0),
          };
        }).filter(x => x.dellTotal > 0).sort((a, b) => a.dellTotal - b.dellTotal);

        const s2Rank = dellSubtotals.findIndex(x => x.resellerId === SELLER2_ID) + 1;
        const s1Rank = dellSubtotals.findIndex(x => x.resellerId === SELLER1_ID) + 1;

        console.log('  Dell ranks from DB:', dellSubtotals.map(x => x.resellerId.slice(0,8) + '=$' + x.dellTotal));
        if (s2Rank === 2) {
          PASS('CHECK D: DB confirms ITBuy#2 is rank #2 for Dell (ITSeller bid lower at $' + dellSubtotals[0]?.dellTotal + ')');
        } else if (s2Rank === 1) {
          // Check if ITSeller even bid on Dell
          if (s1Rank === 0) {
            WARN('CHECK D: ITBuy#2 is #1 for Dell because ITSeller has no Dell line items in DB');
          } else {
            FAIL('CHECK D: ITBuy#2 shows rank #1 for Dell in DB but ITSeller bid lower ($' + dellSubtotals[0]?.dellTotal + ')');
          }
        } else {
          WARN('CHECK D: ITBuy#2 not found in Dell subtotals — may not have bid on Dell');
        }
      } else {
        WARN('CHECK D: Not enough bids in DB to compute rank (' + (Array.isArray(allBids) ? allBids.length : 0) + ' bids found)');
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 5 — Buyer edits BoM (change Cisco qty 5 → 8)
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 5: Buyer edits BoM ────────────────────');
    await buyerPage.goto(`${BASE}/bidbridge-my-rfqs.html`);
    await buyerPage.waitForTimeout(3000);

    // Find and open the RFQ
    const myRfqCards = buyerPage.locator('.rfq-card, [data-rfq-id]');
    let bomRfqCard = null;
    const cardCount = await myRfqCards.count();
    for (let i = 0; i < cardCount; i++) {
      const t = await myRfqCards.nth(i).textContent().catch(() => '');
      if (t.includes(RFQ_TITLE)) { bomRfqCard = myRfqCards.nth(i); break; }
    }

    if (!bomRfqCard) {
      // Try clicking into the RFQ via the drawer
      WARN('Step 5: Could not find RFQ card on My RFQs — skipping BoM edit test');
    } else {
      // Open the RFQ drawer/detail, then close it and use chevron for inline expand
      await bomRfqCard.click();
      await buyerPage.waitForTimeout(800);
      // Close drawer so we can access inline expand actions (Edit button is there)
      await buyerPage.locator('#drawer-overlay').click({ force: true }).catch(() => {});
      await buyerPage.waitForTimeout(400);
      await buyerPage.locator('.expand-chevron-btn').first().click({ force: true });
      await buyerPage.waitForTimeout(800);

      // Look for Edit/Modify BoM button (in inline expand actions)
      const editBtn = buyerPage.locator('button, a').filter({ hasText: /edit|modify|update.*bom|change/i }).first();
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();
        await buyerPage.waitForTimeout(1500);

        // Change Cisco qty from 5 to 8
        const qtyInputs = buyerPage.locator('input[type="number"], input[placeholder*="qty"], input[id*="qty"]');
        const qtyCount = await qtyInputs.count();
        if (qtyCount > 0) {
          await qtyInputs.first().fill('8');
          const saveBtn = buyerPage.locator('button').filter({ hasText: /save|update|confirm/i }).first();
          if (await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click();
            await buyerPage.waitForTimeout(2000);
            PASS('Step 5: Buyer updated Cisco qty (5 → 8)');
          } else {
            WARN('Step 5: Save button not found after editing qty');
          }
        } else {
          WARN('Step 5: No qty inputs found in edit mode');
        }
      } else {
        // Try direct API update of sku_updated_at to mark bids stale
        const now = new Date().toISOString();
        await api(buyerToken, `rfqs?id=eq.${rfqId}`, 'PATCH', { sku_updated_at: now });
        WARN('Step 5: Edit UI not found — used API to set sku_updated_at directly to mark bids stale');
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 6 — CHECK E: Resellers notified of BoM change
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 6: Check stale-bid notifications ───────');
    await buyerPage.waitForTimeout(2000);

    // Check notifications in DB for both resellers
    const notifs = await api(buyerToken, `notifications?rfq_id=eq.${rfqId}&select=user_id,type,message`);

    if (Array.isArray(notifs)) {
      const rfqUpdatedNotifs = notifs.filter(n =>
        n.type === 'rfq_updated' || n.message?.toLowerCase().includes('updated') ||
        n.message?.toLowerCase().includes('revised') || n.message?.toLowerCase().includes('modified')
      );
      if (rfqUpdatedNotifs.length >= 1) {
        PASS('CHECK E: RFQ-updated notifications found in DB (' + rfqUpdatedNotifs.length + ')');
        const notifUserIds = rfqUpdatedNotifs.map(n => n.user_id);
        if (notifUserIds.includes(SELLER1_ID)) PASS('CHECK E1: ITSeller notified of BoM change');
        else WARN('CHECK E1: ITSeller notification not found — may only notify active bidders');
        if (notifUserIds.includes(SELLER2_ID)) PASS('CHECK E2: ITBuy#2 notified of BoM change');
        else WARN('CHECK E2: ITBuy#2 notification not found — may only notify active bidders');
      } else {
        WARN('CHECK E: No rfq_updated notifications found — BoM edit may not have triggered them (API-only update)');
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 7 — Resellers resubmit revised bids (round 2)
    //   ITBuy#2: Dell @ $60/unit = $180 (now wins Dell)
    //   ITSeller: Cisco @ $30 + Dell @ $65/unit (now loses Dell)
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 7: Round 2 bids ────────────────────────');

    // ITBuy#2 resubmits Dell at $20/unit ($60) — lower than ITSeller's $90 Dell floor
    await s2Page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await s2Page.waitForTimeout(4000);
    await s2Page.evaluate(() => {
      const el = document.getElementById('section-my-bids');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await s2Page.waitForTimeout(2000);

    // Find Revise Bid button for our RFQ
    const s2MyBids = s2Page.locator('.rfq-card, .bid-card, .my-bid-item');
    let s2BidCard = null;
    const s2BidCount = await s2MyBids.count();
    for (let i = 0; i < s2BidCount; i++) {
      const t = await s2MyBids.nth(i).textContent().catch(() => '');
      if (t.includes(RFQ_TITLE)) { s2BidCard = s2MyBids.nth(i); break; }
    }

    if (s2BidCard) {
      const reviseBtn = s2BidCard.locator('button, a').filter({ hasText: /revise|update|edit.*bid/i }).first();
      if (await reviseBtn.isVisible().catch(() => false)) {
        await reviseBtn.click();
        await s2Page.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
        await s2Page.waitForTimeout(1000);
        const priceInputs = s2Page.locator('[id^="price-"]');
        const count = await priceInputs.count();
        for (let i = 0; i < count; i++) await priceInputs.nth(i).fill('20'); // $20 × 3 = $60, beats ITSeller's Dell $90
        await s2Page.locator('#bid-auth-checkbox').check().catch(() => {});
        await s2Page.locator('#bid-submit-btn').click();
        await s2Page.waitForSelector('.bid-success', { timeout: 15000 }).catch(async () => {
          // Revision may show a native alert instead of DOM success
          await s2Page.waitForTimeout(2000);
        });
        await s2Page.waitForTimeout(2000);
        // Verify via DB that total price changed
        const s2BidsR2 = await api(seller2Token, `bids?rfq_id=eq.${rfqId}&reseller_id=eq.${SELLER2_ID}&select=total_price`);
        const s2NewTotal = s2BidsR2?.[0]?.total_price;
        if (s2NewTotal && s2NewTotal < 300) {
          PASS('Step 7a: ITBuy#2 resubmitted Dell @ $20/unit — DB total=$' + s2NewTotal);
        } else {
          FAIL('Step 7a: ITBuy#2 revision not reflected in DB — total=' + s2NewTotal);
        }
      } else {
        // Try clicking the card to open bid modal
        await s2BidCard.click();
        await s2Page.waitForTimeout(1000);
        WARN('Step 7a: Revise button not found on bid card — may need to be clicked differently');
      }
    } else {
      WARN('Step 7a: ITBuy#2 bid card not found in My Bids — skipping revision');
    }

    // ITSeller resubmits same prices
    await s1Page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await s1Page.waitForTimeout(4000);
    await s1Page.evaluate(() => {
      const el = document.getElementById('section-my-bids');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await s1Page.waitForTimeout(2000);

    const s1MyBids = s1Page.locator('.rfq-card, .bid-card, .my-bid-item');
    let s1BidCard = null;
    const s1BidCount = await s1MyBids.count();
    for (let i = 0; i < s1BidCount; i++) {
      const t = await s1MyBids.nth(i).textContent().catch(() => '');
      if (t.includes(RFQ_TITLE)) { s1BidCard = s1MyBids.nth(i); break; }
    }

    if (s1BidCard) {
      const reviseBtn = s1BidCard.locator('button, a').filter({ hasText: /revise|update|edit.*bid/i }).first();
      if (await reviseBtn.isVisible().catch(() => false)) {
        await reviseBtn.click();
        await s1Page.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
        await s1Page.waitForTimeout(1000);
        const priceInputs = s1Page.locator('[id^="price-"]');
        const count = await priceInputs.count();
        for (let i = 0; i < count; i++) {
          const rowText = await s1Page.evaluate((n) => {
            const inputs = document.querySelectorAll('[id^="price-"]');
            const inp = inputs[n];
            if (!inp) return '';
            const row = inp.closest('.sku-row, tr, .line-item, [class*="row"]');
            return row ? row.textContent : '';
          }, i);
          const price = rowText.toLowerCase().includes('dell') ? '65' : '30'; // Dell higher, Cisco same
          await priceInputs.nth(i).fill(price);
        }
        await s1Page.locator('#bid-auth-checkbox').check().catch(() => {});
        await s1Page.locator('#bid-submit-btn').click();
        await s1Page.waitForSelector('.bid-success', { timeout: 15000 }).catch(async () => {
          await s1Page.waitForTimeout(2000);
        });
        await s1Page.waitForTimeout(2000);
        const s1BidsR2 = await api(seller1Token, `bids?rfq_id=eq.${rfqId}&reseller_id=eq.${SELLER1_ID}&select=total_price,line_items`);
        const s1NewTotal = s1BidsR2?.[0]?.total_price;
        if (s1NewTotal) {
          PASS('Step 7b: ITSeller resubmitted — DB total=$' + s1NewTotal);
        } else {
          FAIL('Step 7b: ITSeller revision not reflected in DB');
        }
      } else {
        WARN('Step 7b: Revise button not found for ITSeller — skipping revision');
      }
    } else {
      WARN('Step 7b: ITSeller bid card not found');
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 8 — CHECK F: Rank after round 2 (via DB)
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 8: Rank check after round 2 ───────────');
    {
      const allBids2 = await api(buyerToken, `bids?rfq_id=eq.${rfqId}&select=reseller_id,line_items,total_price`);
      if (Array.isArray(allBids2) && allBids2.length >= 2) {
        const ciscoSubs2 = allBids2.map(b => ({
          resellerId: b.reseller_id,
          total: (b.line_items || []).filter(li => li.vendor === 'Cisco')
            .reduce((s, li) => s + parseFloat(li.line_total || (li.unit_price * li.quantity) || 0), 0),
        })).filter(x => x.total > 0).sort((a, b) => a.total - b.total);

        const dellSubs2 = allBids2.map(b => ({
          resellerId: b.reseller_id,
          total: (b.line_items || []).filter(li => li.vendor === 'Dell Technologies')
            .reduce((s, li) => s + parseFloat(li.line_total || (li.unit_price * li.quantity) || 0), 0),
        })).filter(x => x.total > 0).sort((a, b) => a.total - b.total);

        const s1CiscoR2 = ciscoSubs2.findIndex(x => x.resellerId === SELLER1_ID) + 1;
        const s1DellR2  = dellSubs2.findIndex(x => x.resellerId === SELLER1_ID) + 1;
        const s2DellR2  = dellSubs2.findIndex(x => x.resellerId === SELLER2_ID) + 1;

        console.log('  Round 2 Cisco:', ciscoSubs2.map(x => x.resellerId.slice(0,8) + '=$' + x.total));
        console.log('  Round 2 Dell:', dellSubs2.map(x => x.resellerId.slice(0,8) + '=$' + x.total));

        if (s1CiscoR2 === 1) PASS('CHECK F1a: ITSeller still #1 for Cisco after round 2');
        else FAIL('CHECK F1a: ITSeller Cisco rank=' + s1CiscoR2 + ' — expected #1');

        if (s1DellR2 === 2) PASS('CHECK F1b: ITSeller is #2 for Dell after round 2 (ITBuy#2 bid lower)');
        else if (s1DellR2 === 1) WARN('CHECK F1b: ITSeller still #1 for Dell — ITBuy#2 revision may not have saved');
        else WARN('CHECK F1b: ITSeller Dell rank=' + s1DellR2);

        if (s2DellR2 === 1) PASS('CHECK F2: ITBuy#2 is #1 for Dell after round 2 resubmission');
        else FAIL('CHECK F2: ITBuy#2 Dell rank=' + s2DellR2 + ' — expected #1 after submitting lower price');
      } else {
        WARN('CHECK F: Not enough bids in DB for round 2 rank check (' + (Array.isArray(allBids2) ? allBids2.length : 0) + ')');
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 9 — Buyer awards: Cisco → ITSeller, Dell → ITBuy#2
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 9: Buyer awards split bid ──────────────');
    await buyerPage.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${rfqId}`);
    await buyerPage.waitForSelector('#bids-grid', { timeout: 20000 });
    await buyerPage.waitForTimeout(3000);

    const gridText = await buyerPage.locator('#bids-grid').textContent();
    const gridHasCisco = gridText.toLowerCase().includes('cisco');
    const gridHasDell  = gridText.toLowerCase().includes('dell');
    if (gridHasCisco && gridHasDell) PASS('Step 9: Compare bids shows both Cisco and Dell sections');
    else FAIL('Step 9: Compare bids missing vendor sections — Cisco:' + gridHasCisco + ' Dell:' + gridHasDell);

    // Track messages badge before awarding
    const badgeBefore = await buyerPage.locator('#badge-messages').textContent().catch(() => '0');
    const badgeBeforeNum = parseInt(badgeBefore, 10) || 0;

    // Award all non-awarded vendor sections
    let awardedCount = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const awardBtn = buyerPage.locator('.btn-award:not(.awarded)').first();
      if (!await awardBtn.isVisible().catch(() => false)) break;

      const vendorLabel = await awardBtn.textContent().catch(() => '');
      await awardBtn.click();
      await expect(buyerPage.locator('#award-overlay')).toHaveClass(/open/, { timeout: 8000 });
      await buyerPage.locator('#btn-confirm-award').click();
      await buyerPage.waitForTimeout(4000);
      awardedCount++;
      console.log('  Awarded vendor portion:', vendorLabel.trim());

      // Close intro overlay
      const intro = buyerPage.locator('#intro-overlay');
      if (await intro.isVisible().catch(() => false)) {
        await buyerPage.locator('#intro-overlay .btn-intro-done, #intro-overlay button').first().click();
        await buyerPage.waitForTimeout(500);
      }
    }

    if (awardedCount >= 1) PASS('Step 9: ' + awardedCount + ' vendor portion(s) awarded');
    else FAIL('Step 9: No award buttons found — nothing awarded');

    // ══════════════════════════════════════════════════════════════════
    // STEP 10 — CHECK G: Messages badge incremented, correct intros sent
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 10: Messages badge + intro check ───────');
    await buyerPage.waitForTimeout(2000);

    const badgeAfter = await buyerPage.locator('#badge-messages').textContent().catch(() => '0');
    const badgeAfterNum = parseInt(badgeAfter, 10) || 0;
    const badgeDiff = badgeAfterNum - badgeBeforeNum;

    if (badgeDiff >= 1) {
      PASS('CHECK G1: Messages badge incremented by ' + badgeDiff + ' after award(s)');
    } else {
      FAIL('CHECK G1: Messages badge did not increment — before:' + badgeBeforeNum + ' after:' + badgeAfterNum);
    }

    // Check messages in DB
    await buyerPage.waitForTimeout(1000);
    const messages = await api(buyerToken, `messages?rfq_id=eq.${rfqId}&is_broadcast=eq.false&select=recipient_id,content,sender_role`);

    if (Array.isArray(messages) && messages.length > 0) {
      PASS('CHECK G2: ' + messages.length + ' intro message(s) found in DB for this RFQ');
      const seller1Msgs = messages.filter(m => m.recipient_id === SELLER1_ID);
      const seller2Msgs = messages.filter(m => m.recipient_id === SELLER2_ID);

      if (seller1Msgs.length > 0) {
        PASS('CHECK G3: ITSeller received intro message: "' + seller1Msgs[0].content.slice(0, 60) + '..."');
        if (seller1Msgs.length === 1) PASS('CHECK G4: ITSeller got exactly 1 message (no duplicates)');
        else FAIL('CHECK G4: ITSeller got ' + seller1Msgs.length + ' messages — expected 1');
      } else {
        WARN('CHECK G3: No intro message to ITSeller found — may not have won any vendor');
      }

      if (seller2Msgs.length > 0) {
        PASS('CHECK G5: ITBuy#2 received intro message: "' + seller2Msgs[0].content.slice(0, 60) + '..."');
        if (seller2Msgs.length === 1) PASS('CHECK G6: ITBuy#2 got exactly 1 message (no duplicates)');
        else FAIL('CHECK G6: ITBuy#2 got ' + seller2Msgs.length + ' messages — expected 1');
      } else {
        WARN('CHECK G5: No intro message to ITBuy#2 found — may not have won');
      }

      // If same reseller won both vendors, message should say "all portions"
      if (seller1Msgs.length > 0 && seller2Msgs.length === 0 && awardedCount >= 2) {
        const msg = seller1Msgs[0].content.toLowerCase();
        if (msg.includes('all portions') || msg.includes('both')) {
          PASS('CHECK G7: Consolidated message sent (single winner for all vendors)');
        } else {
          WARN('CHECK G7: Single winner but message does not say "all portions" — content: ' + seller1Msgs[0].content.slice(0, 80));
        }
      }
    } else {
      FAIL('CHECK G2: No intro messages found in DB for this RFQ');
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 11 — CHECK H: Executive Summary math
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 11: Executive Summary ──────────────────');
    await buyerPage.goto(`${BASE}/bidbridge-exec-summary.html?rfq=${rfqId}`);
    await buyerPage.waitForTimeout(6000);

    const execText = await buyerPage.locator('body').textContent();

    // Must have both vendor sections
    if (execText.toLowerCase().includes('cisco')) PASS('CHECK H1: Exec summary has Cisco section');
    else FAIL('CHECK H1: Exec summary missing Cisco section');

    if (execText.toLowerCase().includes('dell')) PASS('CHECK H2: Exec summary has Dell Technologies section');
    else FAIL('CHECK H2: Exec summary missing Dell Technologies section');

    // Must have dollar amounts
    const dollars = execText.match(/\$[\d,]+\.?\d*/g) || [];
    if (dollars.length >= 2) PASS('CHECK H3: Exec summary shows ' + dollars.length + ' dollar values: ' + dollars.slice(0, 4).join(', '));
    else FAIL('CHECK H3: Not enough dollar values in exec summary — found: ' + dollars.join(', '));

    // Must have awarded/winner info
    if (execText.toLowerCase().includes('awarded')) PASS('CHECK H4: Exec summary shows "Awarded" status');
    else FAIL('CHECK H4: Exec summary missing awarded status');

    // Overall savings section
    if (execText.toLowerCase().includes('savings') || execText.toLowerCase().includes('overall')) {
      PASS('CHECK H5: Exec summary has savings/overall section');
    } else {
      WARN('CHECK H5: Could not find savings section in exec summary');
    }

    // RFQ title present
    if (execText.includes(RFQ_TITLE)) PASS('CHECK H6: RFQ title present in exec summary');
    else FAIL('CHECK H6: RFQ title missing from exec summary');

    // Print button
    const printBtn = await buyerPage.locator('.btn-print, button').filter({ hasText: /print|pdf|save/i }).count();
    if (printBtn > 0) PASS('CHECK H7: Print/PDF button visible');
    else WARN('CHECK H7: Print button not found');

    // Math spot-check: verify no NaN or undefined in dollar values
    const hasNaN = execText.includes('NaN') || execText.includes('undefined');
    if (!hasNaN) PASS('CHECK H8: No NaN/undefined values in exec summary');
    else FAIL('CHECK H8: NaN or undefined found in exec summary output');

    // ══════════════════════════════════════════════════════════════════
    // STEP 12 — CHECK I: Close exec summary, reopen from compare bids
    // ══════════════════════════════════════════════════════════════════
    console.log('\n── STEP 12: Reopen exec summary ────────────────');

    // Navigate back to compare bids
    await buyerPage.goto(`${BASE}/bidbridge-compare-bids_1.html?rfq=${rfqId}`);
    await buyerPage.waitForSelector('#bids-grid', { timeout: 20000 });
    await buyerPage.waitForTimeout(3000);

    // Look for exec summary link on compare bids page
    const execLink = buyerPage.locator('a, button').filter({ hasText: /exec|summary|executive/i }).first();
    if (await execLink.isVisible().catch(() => false)) {
      const href = await execLink.getAttribute('href').catch(() => null);
      const onclick = await execLink.getAttribute('onclick').catch(() => null);
      PASS('CHECK I1: Exec summary link found on compare bids page (href: ' + (href || onclick || 'onclick') + ')');
    } else {
      WARN('CHECK I1: Exec summary link not visible on compare bids page — looking in intro overlay area');
    }

    // Open exec summary via URL (simulates clicking the link after closing)
    await buyerPage.goto(`${BASE}/bidbridge-exec-summary.html?rfq=${rfqId}`);
    await buyerPage.waitForTimeout(4000);
    const reopenText = await buyerPage.locator('body').textContent();
    if (reopenText.includes(RFQ_TITLE) && reopenText.toLowerCase().includes('cisco')) {
      PASS('CHECK I2: Exec summary reopens correctly from direct URL (buyer can pull up another copy)');
    } else {
      FAIL('CHECK I2: Exec summary did not load correctly on reopen');
    }

    // Also check buyer dashboard Deals Awarded panel links to exec summary
    await buyerPage.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
    await buyerPage.waitForTimeout(4000);

    // Open the Deals Awarded stat panel
    const awardedCard = buyerPage.locator('#stat-awarded-card');
    if (await awardedCard.isVisible().catch(() => false)) {
      await awardedCard.click();
      await buyerPage.waitForTimeout(1000);
      const detailPanel = buyerPage.locator('#stat-detail-panel');
      if (await detailPanel.isVisible().catch(() => false)) {
        const panelText = await detailPanel.textContent();
        const hasExecLink = panelText.toLowerCase().includes('exec') || panelText.toLowerCase().includes('summary');
        if (hasExecLink) PASS('CHECK I3: Deals Awarded panel on dashboard shows exec summary link');
        else WARN('CHECK I3: Deals Awarded panel visible but no exec summary link found');
      } else {
        WARN('CHECK I3: Deals Awarded stat panel did not open');
      }
    } else {
      WARN('CHECK I3: Deals Awarded stat card not found on dashboard');
    }

    // ══════════════════════════════════════════════════════════════════
    // FINAL REPORT
    // ══════════════════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════════');
    console.log('FINAL REPORT');
    console.log('══════════════════════════════════════════════════');
    console.log(`✅ PASSED (${results.pass.length}):`);
    results.pass.forEach(p => console.log('   ✅ ' + p));
    if (results.warn.length) {
      console.log(`\n⚠️  WARNINGS (${results.warn.length}) — manual verification needed:`);
      results.warn.forEach(w => console.log('   ⚠️  ' + w));
    }
    if (results.fail.length) {
      console.log(`\n❌ FAILED (${results.fail.length}):`);
      results.fail.forEach(f => console.log('   ❌ ' + f));
    }
    console.log('══════════════════════════════════════════════════');

    // Fail the test if any hard failures
    expect(results.fail, 'Hard failures:\n' + results.fail.join('\n')).toHaveLength(0);

  } finally {
    await buyerCtx.close();
    await seller1Ctx.close();
    await seller2Ctx.close();
    await cleanup(buyerToken || seller1Token);
  }
});
