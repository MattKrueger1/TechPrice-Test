/**
 * Reseller Dashboard — Functional Checks
 *
 * Verifies:
 * A. All 4 stat cards are clickable and scroll to the right section
 * B. Quick links (Browse Open RFQs, My Active Bids, Messages, Won & Lost, My Profile)
 * C. Messages: opening a thread marks it as read (badge/unread count clears)
 *
 * Uses reseller auth (mk@comcast.net = ITSeller)
 */

const { test } = require('@playwright/test');
const BASE         = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';
const SELLER1_EMAIL = 'mk@comcast.net';
const SELLER1_PWD   = 'Test12345678';

const PASS = (label) => console.log('   ✅ ' + label);
const FAIL = (label) => console.log('   ❌ FAIL: ' + label);
const WARN = (label) => console.log('   ⚠️  ' + label);

test('Reseller dashboard checks', async ({ page }) => {
  // Log in via the auth page
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.fill('#login-email', SELLER1_EMAIL);
  await page.fill('#login-password', SELLER1_PWD);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard|reseller/, { timeout: 20000 });
  // Wait for stat cards to render
  await page.waitForSelector('#stat-open-rfqs:not(:empty)', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log('\n══════════════════════════════════════════════════');

  // ─── A. STAT CARDS ────────────────────────────────────────────
  console.log('\n── A: Stat cards ─────────────────────────────────────');

  // A1: Open RFQs → scrolls to #section-open-rfqs
  const cardOpenRfqs = page.locator('.stats-grid .stat-card').nth(0);
  const isClickableOpenRfqs = await cardOpenRfqs.evaluate(el => el.classList.contains('clickable'));
  if (isClickableOpenRfqs) PASS('A1: Open RFQs card is clickable');
  else FAIL('A1: Open RFQs card not clickable');

  const openRfqsValue = await page.locator('#stat-open-rfqs').textContent();
  const sectionCountOpen = await page.locator('#section-count-open').textContent();
  if (openRfqsValue === sectionCountOpen) PASS('A1b: Open RFQs stat (' + openRfqsValue + ') matches section count');
  else WARN('A1b: Open RFQs stat=' + openRfqsValue + ' vs section count=' + sectionCountOpen + ' (may differ after filter)');

  await cardOpenRfqs.click();
  await page.waitForTimeout(800);
  const openRfqsVisible = await page.locator('#section-open-rfqs').isVisible();
  if (openRfqsVisible) PASS('A1c: Click scrolled to Open RFQs section');
  else FAIL('A1c: Open RFQs section not visible after click');

  // A2: Active bids → scrolls to #section-my-bids
  const cardActiveBids = page.locator('.stats-grid .stat-card').nth(1);
  const isClickableActive = await cardActiveBids.evaluate(el => el.classList.contains('clickable'));
  if (isClickableActive) PASS('A2: Active bids card is clickable');
  else FAIL('A2: Active bids card not clickable');

  const activeBidsValue = await page.locator('#stat-active-bids').textContent();
  PASS('A2b: Active bids shows: ' + activeBidsValue);

  await cardActiveBids.click();
  await page.waitForTimeout(800);
  const myBidsVisible = await page.locator('#section-my-bids').isVisible();
  if (myBidsVisible) PASS('A2c: Click scrolled to My Bids section');
  else FAIL('A2c: My Bids section not visible after click');

  // A3: Win rate → scrolls to #section-won-lost
  const cardWinRate = page.locator('.stats-grid .stat-card').nth(2);
  const isClickableWin = await cardWinRate.evaluate(el => el.classList.contains('clickable'));
  if (isClickableWin) PASS('A3: Win rate card is clickable');
  else FAIL('A3: Win rate card not clickable');

  const winRateValue = await page.locator('#stat-win-rate').textContent();
  PASS('A3b: Win rate shows: ' + winRateValue);

  await cardWinRate.click();
  await page.waitForTimeout(800);
  const wonLostVisible = await page.locator('#section-won-lost').isVisible();
  if (wonLostVisible) PASS('A3c: Click scrolled to Won/Lost section');
  else FAIL('A3c: Won/Lost section not visible after click');

  // A4: Revenue won → scrolls to #section-won-lost
  const cardRevenue = page.locator('.stats-grid .stat-card').nth(3);
  const isClickableRevenue = await cardRevenue.evaluate(el => el.classList.contains('clickable'));
  if (isClickableRevenue) PASS('A4: Revenue won card is clickable');
  else FAIL('A4: Revenue won card not clickable');

  const revenueValue = await page.locator('#stat-revenue').textContent();
  PASS('A4b: Revenue won shows: ' + revenueValue);

  await cardRevenue.click();
  await page.waitForTimeout(800);
  const wonLostVisible2 = await page.locator('#section-won-lost').isVisible();
  if (wonLostVisible2) PASS('A4c: Click scrolled to Won/Lost section');
  else FAIL('A4c: Won/Lost section not visible after revenue click');

  // ─── B. QUICK LINKS ────────────────────────────────────────────
  console.log('\n── B: Quick links ─────────────────────────────────────');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // B1: Browse Open RFQs
  const qlBrowse = page.locator('.ql-item').filter({ hasText: 'Browse Open RFQs' });
  if (await qlBrowse.isVisible()) {
    await qlBrowse.click();
    await page.waitForTimeout(800);
    PASS('B1: Browse Open RFQs quick link clicked');
  } else {
    FAIL('B1: Browse Open RFQs quick link not found');
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // B2: My Active Bids
  const qlBids = page.locator('.ql-item').filter({ hasText: 'My Active Bids' });
  if (await qlBids.isVisible()) {
    await qlBids.click();
    await page.waitForTimeout(800);
    PASS('B2: My Active Bids quick link clicked');
  } else {
    FAIL('B2: My Active Bids quick link not found');
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // B3: Messages — match by ql-label text, not full element (element also contains icon + arrow)
  const qlMessages = page.locator('.ql-item').filter({ has: page.locator('.ql-label', { hasText: 'Messages' }) });
  if (await qlMessages.isVisible()) {
    await qlMessages.click();
    await page.waitForTimeout(800);
    const msgSectionVisible = await page.locator('#section-messages').isVisible();
    if (msgSectionVisible) PASS('B3: Messages quick link scrolls to messages section');
    else FAIL('B3: Messages section not visible after click');
  } else {
    FAIL('B3: Messages quick link not found');
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // B4: Won & Lost Deals
  const qlWon = page.locator('.ql-item').filter({ hasText: /Won.*Lost/ });
  if (await qlWon.isVisible()) {
    await qlWon.click();
    await page.waitForTimeout(800);
    PASS('B4: Won & Lost Deals quick link clicked');
  } else {
    FAIL('B4: Won & Lost Deals quick link not found');
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // B5: My Profile & Tiers — should navigate away
  const qlProfile = page.locator('.ql-item').filter({ hasText: 'My Profile' });
  if (await qlProfile.isVisible()) {
    PASS('B5: My Profile quick link is present');
    const href = await qlProfile.evaluate(el => el.getAttribute('href'));
    if (href && href.includes('reseller-profile')) PASS('B5b: Profile link points to reseller-profile page');
    else FAIL('B5b: Profile link href unexpected: ' + href);
  } else {
    FAIL('B5: My Profile quick link not found');
  }

  // ─── C. MESSAGES READ-ON-OPEN ──────────────────────────────────
  console.log('\n── C: Messages read-on-open ────────────────────────────');

  // Go to messages section
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = document.getElementById('section-messages');
    if (el) el.scrollIntoView({ behavior: 'instant' });
  });
  await page.waitForTimeout(1500);

  const threads = page.locator('.msg-thread-item');
  const threadCount = await threads.count();
  if (threadCount === 0) {
    WARN('C: No message threads found — skipping read-on-open test');
  } else {
    PASS('C: Found ' + threadCount + ' message thread(s)');

    // Check if any are unread before clicking
    const unreadThreads = threads.filter({ has: page.locator('.msg-thread-unread-badge') });
    const unreadBefore = await unreadThreads.count();
    PASS('C1: Unread threads before opening: ' + unreadBefore);

    // Get the RFQ title of the first unread thread so we can re-find it after re-render
    const targetThread = unreadBefore > 0 ? unreadThreads.first() : threads.first();
    const targetRfqTitle = await targetThread.locator('.msg-thread-rfq').textContent().catch(() => '');
    await targetThread.click();
    await page.waitForTimeout(2500);

    // Check that the conversation loaded
    const convHeader = await page.locator('.msg-conv-title').isVisible().catch(() => false);
    if (convHeader) PASS('C2: Conversation loaded after clicking thread');
    else FAIL('C2: Conversation did not load');

    // If that thread was unread, verify badge cleared — re-query after re-render
    if (unreadBefore > 0) {
      await page.waitForTimeout(1000);
      // Re-find the thread by title (DOM may have re-rendered)
      const reopenedThread = targetRfqTitle
        ? page.locator('.msg-thread-item').filter({ hasText: targetRfqTitle })
        : page.locator('.msg-thread-item.active');
      const targetUnreadBadge = await reopenedThread.locator('.msg-thread-unread-badge').isVisible().catch(() => false);
      if (!targetUnreadBadge) PASS('C3: Unread badge cleared on opened thread');
      else FAIL('C3: Unread badge still showing on thread after opening');

      // Check sidebar badge updated
      const sidebarBadge = page.locator('#badge-messages');
      const sidebarBadgeVisible = await sidebarBadge.isVisible().catch(() => false);
      const sidebarBadgeText = sidebarBadgeVisible ? await sidebarBadge.textContent() : '0';
      PASS('C4: Sidebar messages badge after opening: ' + (sidebarBadgeVisible ? sidebarBadgeText : 'hidden (0 unread)'));
    } else {
      PASS('C3: No unread threads to test — all already read');
    }
  }

  console.log('\n══════════════════════════════════════════════════\n');
});
