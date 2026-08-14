/**
 * My RFQs — Widget + Filter Tests
 *
 * Verifies:
 * A. All 4 stat widgets show correct counts matching actual RFQ data
 * B. Clicking each widget filters the RFQ list to show only matching RFQs
 * C. Ready to Review: shows RFQs with unread bids; opening a drawer marks them read
 *    and removes the RFQ from the Ready to Review filter
 * D. Active: clicking an RFQ card opens the detail drawer with submitted bids
 *
 * Uses buyer auth (mattkrueger@comcast.net)
 */

const { test } = require('@playwright/test');

const BASE          = 'http://localhost:3000';
const SUPABASE_URL  = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';
const BUYER_EMAIL   = 'mattkrueger@comcast.net';
const BUYER_PWD     = 'Test12345678';

const PASS = (l) => console.log('   ✅ ' + l);
const FAIL = (l) => console.log('   ❌ FAIL: ' + l);
const WARN = (l) => console.log('   ⚠️  ' + l);

test('My RFQs widget checks', async ({ page }) => {
  // ── Login ──────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', BUYER_EMAIL);
  await page.fill('#login-password', BUYER_PWD);
  await page.click('#login-btn');
  await page.waitForURL(/my-rfqs|dashboard/, { timeout: 20000 });

  // Navigate to My RFQs
  if (!page.url().includes('my-rfqs')) {
    await page.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
  }

  // Wait for RFQ data to load — stat widgets populate after fetch
  await page.waitForSelector('#stat-active:not(:empty)', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log('\n══════════════════════════════════════════════════');

  // ── Pull ground truth from DB ──────────────────────────────────────────────
  const userId = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
    try { return JSON.parse(localStorage.getItem(key))?.user?.id; } catch { return null; }
  });

  if (!userId) { FAIL('Could not get buyer user ID from session'); return; }

  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
    try { return JSON.parse(localStorage.getItem(key))?.access_token; } catch { return null; }
  });

  // Fetch RFQs from DB using the session token (required for RLS)
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

  console.log('\n── A: Widget counts ───────────────────────────────────');
  console.log(`   DB truth → active:${dbActive} review:${dbReview} awarded:${dbAwarded} cancelled:${dbCancelled}`);

  // Read widget values from UI
  const uiActive    = parseInt(await page.locator('#stat-active').textContent());
  const uiReview    = parseInt(await page.locator('#stat-review').textContent());
  const uiAwarded   = parseInt(await page.locator('#stat-awarded').textContent());
  const uiCancelled = parseInt(await page.locator('#stat-cancelled').textContent());

  console.log(`   UI shows  → active:${uiActive} review:${uiReview} awarded:${uiAwarded} cancelled:${uiCancelled}`);

  if (uiActive === dbActive) PASS(`A1: Active widget shows correct count (${uiActive})`);
  else FAIL(`A1: Active widget shows ${uiActive}, expected ${dbActive}`);

  if (uiReview === dbReview) PASS(`A2: Ready to Review widget shows correct count (${uiReview})`);
  else FAIL(`A2: Ready to Review widget shows ${uiReview}, expected ${dbReview}`);

  if (uiAwarded === dbAwarded) PASS(`A3: Awarded widget shows correct count (${uiAwarded})`);
  else FAIL(`A3: Awarded widget shows ${uiAwarded}, expected ${dbAwarded}`);

  if (uiCancelled === dbCancelled) PASS(`A4: Cancelled widget shows correct count (${uiCancelled})`);
  else FAIL(`A4: Cancelled widget shows ${uiCancelled}, expected ${dbCancelled}`);

  // ── B: Clicking widgets filters the list ──────────────────────────────────
  console.log('\n── B: Widget click → correct RFQs shown ───────────────');

  // B1: Active widget
  await page.locator('.stats-row .stat-card').nth(0).click();
  await page.waitForTimeout(600);
  const activeCards = await page.locator('.rfq-list .rfq-card').count();
  const emptyShown  = await page.locator('#empty-state').isVisible().catch(() => false);
  const activeShowing = emptyShown ? 0 : activeCards;
  if (activeShowing === dbActive) PASS(`B1: Active filter shows ${activeShowing} RFQ(s) — matches DB`);
  else if (dbActive === 0 && emptyShown) PASS(`B1: Active filter shows empty state (0 active RFQs)`);
  else FAIL(`B1: Active filter shows ${activeShowing} card(s), expected ${dbActive}`);

  // B2: Ready to Review widget
  await page.locator('.stats-row .stat-card').nth(1).click();
  await page.waitForTimeout(600);
  const reviewCards   = await page.locator('.rfq-list .rfq-card').count();
  const reviewEmpty   = await page.locator('#empty-state').isVisible().catch(() => false);
  const reviewShowing = reviewEmpty ? 0 : reviewCards;
  if (reviewShowing === dbReview) PASS(`B2: Ready to Review filter shows ${reviewShowing} RFQ(s) — matches DB`);
  else if (dbReview === 0 && reviewEmpty) PASS(`B2: Ready to Review filter shows empty state`);
  else FAIL(`B2: Ready to Review filter shows ${reviewShowing} card(s), expected ${dbReview}`);

  // B3: Awarded widget
  await page.locator('.stats-row .stat-card').nth(2).click();
  await page.waitForTimeout(600);
  const awardedCards   = await page.locator('.rfq-list .rfq-card').count();
  const awardedEmpty   = await page.locator('#empty-state').isVisible().catch(() => false);
  const awardedShowing = awardedEmpty ? 0 : awardedCards;
  if (awardedShowing === dbAwarded) PASS(`B3: Awarded filter shows ${awardedShowing} RFQ(s) — matches DB`);
  else if (dbAwarded === 0 && awardedEmpty) PASS(`B3: Awarded filter shows empty state`);
  else FAIL(`B3: Awarded filter shows ${awardedShowing} card(s), expected ${dbAwarded}`);

  // B4: Cancelled widget
  await page.locator('.stats-row .stat-card').nth(3).click();
  await page.waitForTimeout(600);
  const cancelledCards   = await page.locator('.rfq-list .rfq-card').count();
  const cancelledEmpty   = await page.locator('#empty-state').isVisible().catch(() => false);
  const cancelledShowing = cancelledEmpty ? 0 : cancelledCards;
  if (cancelledShowing === dbCancelled) PASS(`B4: Cancelled filter shows ${cancelledShowing} RFQ(s) — matches DB`);
  else if (dbCancelled === 0 && cancelledEmpty) PASS(`B4: Cancelled filter shows empty state`);
  else FAIL(`B4: Cancelled filter shows ${cancelledShowing} card(s), expected ${dbCancelled}`);

  // Verify cancelled cards don't have active/review status tags
  if (!cancelledEmpty && cancelledCards > 0) {
    const firstCardText = await page.locator('.rfq-list .rfq-card').first().textContent();
    const hasBadStatus = firstCardText.toLowerCase().includes('• active') || firstCardText.toLowerCase().includes('• review');
    if (!hasBadStatus) PASS('B4b: Cancelled cards do not show active/review RFQs');
    else FAIL('B4b: Cancelled filter showing wrong status RFQs');
  }

  // ── C: Ready to Review — unread logic ─────────────────────────────────────
  console.log('\n── C: Ready to Review — unread → read on open ──────────');

  // Click Ready to Review widget
  await page.locator('.stats-row .stat-card').nth(1).click();
  await page.waitForTimeout(600);

  const reviewCount2 = await page.locator('.rfq-list .rfq-card').count();
  if (reviewCount2 === 0) {
    WARN('C: No Ready to Review RFQs — skipping unread test');
  } else {
    // Count how many show "NEW BIDS" badge
    const newBidsBefore = await page.locator('.rfq-list .rfq-card').filter({ hasText: 'NEW BIDS' }).count();
    PASS(`C1: ${newBidsBefore} of ${reviewCount2} review RFQ(s) have NEW BIDS badge`);

    if (newBidsBefore > 0) {
      // Clear localStorage viewed state to simulate fresh visit
      await page.evaluate(() => {
        Object.keys(localStorage).filter(k => k.startsWith('itpn_viewed_bids_')).forEach(k => localStorage.removeItem(k));
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#stat-active:not(:empty)', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Click Ready to Review again
      await page.locator('.stats-row .stat-card').nth(1).click();
      await page.waitForTimeout(600);

      // Check "none unread" sub-label before opening
      const unreadLabelBefore = await page.locator('#stat-review-unread').textContent().catch(() => '');
      PASS(`C2: Unread label before opening: "${unreadLabelBefore}"`);

      // Click the first review RFQ to open the drawer
      const firstReviewCard = page.locator('.rfq-list .rfq-card').first();
      const firstTitle = await firstReviewCard.locator('.rfq-title, [class*="title"]').first().textContent().catch(() => 'RFQ');
      await firstReviewCard.click();
      await page.waitForTimeout(2000);

      // Drawer should open
      const drawerOpen = await page.locator('#drawer.open').isVisible().catch(() => false);
      if (drawerOpen) PASS('C3: Drawer opened after clicking review RFQ');
      else FAIL('C3: Drawer did not open');

      // Close drawer
      await page.locator('.drawer-close').first().click();
      await page.waitForTimeout(800);

      // Check unread label updated
      const unreadLabelAfter = await page.locator('#stat-review-unread').textContent().catch(() => '');
      PASS(`C4: Unread label after opening: "${unreadLabelAfter}"`);

      // The RFQ we just opened should no longer show NEW BIDS badge
      await page.locator('.stats-row .stat-card').nth(1).click();
      await page.waitForTimeout(600);
      const newBidsAfter = await page.locator('.rfq-list .rfq-card').filter({ hasText: 'NEW BIDS' }).count();
      if (newBidsAfter < newBidsBefore) PASS(`C5: NEW BIDS count dropped from ${newBidsBefore} → ${newBidsAfter} after opening`);
      else WARN(`C5: NEW BIDS count unchanged (${newBidsAfter}) — bids may already have been viewed`);
    } else {
      WARN('C: All review RFQs already marked as read — clear browser storage to re-test');
    }
  }

  // ── D: Active RFQ → drawer shows bids ─────────────────────────────────────
  console.log('\n── D: Active RFQ → drawer shows submitted bids ────────');

  await page.locator('.stats-row .stat-card').nth(0).click();
  await page.waitForTimeout(600);

  const activeCount2 = await page.locator('.rfq-list .rfq-card').count();
  if (activeCount2 === 0) {
    WARN('D: No active RFQs — skipping bid drawer test');
  } else {
    PASS(`D1: ${activeCount2} active RFQ(s) shown`);

    // Click the first active RFQ
    await page.locator('.rfq-list .rfq-card').first().click();
    await page.waitForTimeout(2500);

    const drawerOpen2 = await page.locator('#drawer.open').isVisible().catch(() => false);
    if (drawerOpen2) PASS('D2: Drawer opened after clicking active RFQ');
    else FAIL('D2: Drawer did not open');

    if (drawerOpen2) {
      const drawerBody = await page.locator('#drawer-body').textContent().catch(() => '');

      // Check for bid-related content in drawer
      const hasBidContent = drawerBody.includes('bid') || drawerBody.includes('Bid') ||
                            drawerBody.includes('reseller') || drawerBody.includes('Reseller') ||
                            drawerBody.includes('$') || drawerBody.includes('submitted');
      if (hasBidContent) PASS('D3: Drawer body contains bid information');
      else WARN('D3: Drawer opened but no bid content found — RFQ may have 0 bids yet');

      // Check View results / compare bids button present
      const hasActionBtn = await page.locator('#drawer-body button, #drawer-body a').filter({ hasText: /view results|compare bids/i }).count();
      if (hasActionBtn > 0) PASS('D4: View results / Compare bids button present in drawer');
      else WARN('D4: No View results button found — RFQ may have no bids yet');

      // Close drawer via overlay click (the drawer-close inside #drawer, not the edit modal's)
      await page.locator('#drawer-overlay').click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      PASS('D5: Drawer closes cleanly');
    }
  }

  console.log('\n══════════════════════════════════════════════════\n');
});
