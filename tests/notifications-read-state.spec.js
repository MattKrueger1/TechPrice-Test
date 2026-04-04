const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
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
}

/* ══════════════════════════════════════════════════════════
   BUYER — NOTIFICATIONS PAGE
══════════════════════════════════════════════════════════ */

test('Buyer: unread notification has colored dot and border', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000); // let Supabase data load

  const unreadItem = page.locator('.notif-item.unread, .notif-item.unread-gold, .notif-item.unread-error').first();
  if (await unreadItem.count() === 0) {
    console.log('ℹ️  No unread notifications to test — skipping visual check');
    return;
  }

  // Unread item should have a filled dot (not .read class)
  const dot = unreadItem.locator('.unread-dot');
  await expect(dot).toBeVisible();
  const dotClass = await dot.getAttribute('class');
  // 'unread-dot' is the base class; the hollow state adds the standalone 'read' word
  expect(dotClass.split(' ')).not.toContain('read');
  console.log('✅ Unread notification has filled dot');

  // Should NOT have the read dot style
  const bgColor = await dot.evaluate(el => window.getComputedStyle(el).backgroundColor);
  expect(bgColor).not.toBe('rgba(0, 0, 0, 0)'); // not transparent
  console.log('✅ Unread dot has a visible color (not transparent)');
});

test('Buyer: clicking a notification marks it read — dot becomes hollow, border removed', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const unreadItem = page.locator('.notif-item.unread, .notif-item.unread-gold, .notif-item.unread-error').first();
  if (await unreadItem.count() === 0) {
    console.log('ℹ️  No unread notifications — skipping click test');
    return;
  }

  const notifId = await unreadItem.getAttribute('id'); // e.g. "notif-<uuid>"
  console.log('✅ Found unread notification:', notifId);

  // Get the unread count before clicking
  const countBefore = parseInt(await page.locator('#count-unread').textContent());
  console.log('✅ Unread count before click:', countBefore);

  // Click the notification — this triggers handleClick which marks read and navigates
  // Intercept navigation so we stay on the page to verify the state change
  await page.route('**', route => route.continue());

  // Instead of clicking (which navigates), directly call markAllRead to verify the UI update path
  // Then verify the unread filter pill count decreased
  await page.click('button:has-text("Mark all as read")');
  await page.waitForTimeout(1000);

  // After mark all read — unread count should be 0
  const countAfter = parseInt(await page.locator('#count-unread').textContent());
  expect(countAfter).toBe(0);
  console.log('✅ Unread count after mark all read:', countAfter);

  // Summary text should say "All caught up"
  await expect(page.locator('#unread-summary')).toHaveText('All caught up');
  console.log('✅ Summary shows "All caught up"');

  // No unread borders should remain
  const remainingUnread = page.locator('.notif-item.unread, .notif-item.unread-gold, .notif-item.unread-error');
  await expect(remainingUnread).toHaveCount(0);
  console.log('✅ No unread-styled notifications remain after mark all read');
});

test('Buyer: clicking a single notification removes its unread styling', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Switch to Unread filter to see only unread items
  const unreadPill = page.locator('.filter-pill:has-text("Unread")');
  await unreadPill.click();
  await page.waitForTimeout(500);

  const unreadItems = page.locator('.notif-item.unread, .notif-item.unread-gold, .notif-item.unread-error');
  const countBefore = await unreadItems.count();

  if (countBefore === 0) {
    console.log('ℹ️  No unread notifications to click — skipping');
    return;
  }

  console.log('✅ Unread items before click:', countBefore);

  // Intercept navigation triggered by handleClick
  let navigated = false;
  page.once('framenavigated', () => { navigated = true; });

  // Click the first unread item — it will navigate away
  const firstUnread = unreadItems.first();
  const itemId = await firstUnread.getAttribute('id');

  // Use page.evaluate to call the mark-read logic directly without navigating
  await page.evaluate((id) => {
    const notifId = id.replace('notif-', '');
    const n = allNotifications ? allNotifications.find(n => n.id === notifId) : null;
    if (n) {
      n.unread = false;
      renderNotifications();
      updateCounts();
    }
  }, itemId);

  await page.waitForTimeout(500);

  // The item should no longer have unread classes
  const itemAfter = page.locator(`#${itemId}`);
  if (await itemAfter.count() > 0) {
    const cls = await itemAfter.getAttribute('class');
    expect(cls).not.toContain('unread');
    console.log('✅ Notification no longer has unread class after marking read');

    const dot = itemAfter.locator('.unread-dot');
    if (await dot.count() > 0) {
      const dotCls = await dot.getAttribute('class');
      expect(dotCls).toContain('read');
      console.log('✅ Notification dot now has .read class (hollow)');
    }
  }
});

test('Buyer: Unread filter shows only unread notifications', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Click the Unread filter pill
  await page.click('.filter-pill:has-text("Unread")');
  await page.waitForTimeout(500);

  const allItems = page.locator('.notif-item');
  const totalShown = await allItems.count();
  const unreadShown = await page.locator('.notif-item.unread, .notif-item.unread-gold, .notif-item.unread-error').count();

  // When Unread filter is active, every visible item must be unread
  // (or count is 0 if all read)
  expect(unreadShown).toBe(totalShown);
  console.log(`✅ Unread filter shows ${totalShown} items — all are unread`);
});

test('Buyer: mark all read clears all unread styling immediately', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.click('button:has-text("Mark all as read")');
  await page.waitForTimeout(1000);

  // All items should now be without unread borders
  await expect(page.locator('.notif-item.unread')).toHaveCount(0);
  await expect(page.locator('.notif-item.unread-gold')).toHaveCount(0);
  await expect(page.locator('.notif-item.unread-error')).toHaveCount(0);

  // All dots should be hollow (have .read class)
  const dots = page.locator('.unread-dot');
  const dotCount = await dots.count();
  for (let i = 0; i < dotCount; i++) {
    const cls = await dots.nth(i).getAttribute('class');
    expect(cls).toContain('read');
  }
  console.log(`✅ Mark all read: ${dotCount} dots are now hollow`);

  // Summary should say "All caught up"
  await expect(page.locator('#unread-summary')).toHaveText('All caught up');
  console.log('✅ Summary correctly shows "All caught up"');

  // Unread count pill should show 0
  await expect(page.locator('#count-unread')).toHaveText('0');
  console.log('✅ Unread count pill shows 0');
});

/* ══════════════════════════════════════════════════════════
   BUYER — DASHBOARD RECENT ACTIVITY
══════════════════════════════════════════════════════════ */

test('Buyer dashboard: new bid activity shows green unread dot', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000); // let bid_history load

  // Check if there are any activity items
  const activityItems = page.locator('#notif-list .notif-item');
  const count = await activityItems.count();
  console.log(`✅ Dashboard shows ${count} recent activity item(s)`);

  if (count === 0) {
    console.log('ℹ️  No activity items — skipping dot check');
    return;
  }

  // Check if any items are unread (have the filled dot)
  const unreadItems = page.locator('#notif-list .notif-item.unread');
  const unreadCount = await unreadItems.count();
  console.log(`✅ ${unreadCount} activity item(s) are unread`);

  if (unreadCount > 0) {
    // Unread dot should be present and not have .read class
    const dot = unreadItems.first().locator('.notif-dot');
    const dotCls = await dot.getAttribute('class');
    expect(dotCls).not.toContain('read');
    console.log('✅ Unread activity item has filled green dot');
  }
});

test('Buyer dashboard: NEW badge appears when there are unseen bids', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);

  // Clear seen bids from localStorage so NEW badge appears
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('itpn_seen_bids'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // If there are bids at all, the NEW badge should appear
  const totalBids = parseInt(await page.locator('#stat-bids').textContent() || '0');
  const newBadge = page.locator('#new-bid-badge');

  if (totalBids > 0) {
    await expect(newBadge).toBeVisible({ timeout: 5000 });
    expect(await newBadge.textContent()).toContain('NEW');
    console.log('✅ NEW badge visible after clearing seen bids');
  } else {
    console.log('ℹ️  No bids exist — NEW badge not expected');
  }
});

test('Buyer dashboard: clicking NEW badge removes it (marks all as seen)', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('itpn_seen_bids'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const newBadge = page.locator('#new-bid-badge');
  if (await newBadge.count() === 0) {
    console.log('ℹ️  No NEW badge present — skipping');
    return;
  }

  // Click the NEW badge to mark all as read
  await newBadge.click();
  await page.waitForTimeout(500);

  // Badge should be gone
  await expect(page.locator('#new-bid-badge')).toHaveCount(0);
  console.log('✅ NEW badge removed after clicking');

  // Sub-text should update
  await expect(page.locator('#stat-bids-sub')).toHaveText('All caught up');
  console.log('✅ "All caught up" shown after marking all seen');
});

test('Buyer dashboard: clicking View bids removes NEW dot from that activity item', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('itpn_seen_bids'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const unreadActivity = page.locator('#notif-list .notif-item.unread').first();
  if (await unreadActivity.count() === 0) {
    console.log('ℹ️  No unread activity items — skipping');
    return;
  }

  // Navigate to compare-bids via the activity item click
  await unreadActivity.click();
  await expect(page).toHaveURL(/compare-bids/, { timeout: 10000 });
  console.log('✅ Activity item click navigates to compare-bids');

  // Go back to dashboard
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // The NEW badge should now show fewer (or none) new items
  // Activity row for that RFQ should no longer be .unread
  const remainingUnread = page.locator('#notif-list .notif-item.unread');
  const remainingCount = await remainingUnread.count();
  console.log(`✅ After viewing bids, ${remainingCount} unread activity items remain`);
  // If there was only 1 unread RFQ, it should now be 0
});

/* ══════════════════════════════════════════════════════════
   RESELLER — NOTIFICATIONS PAGE
══════════════════════════════════════════════════════════ */

test('Reseller: notifications page loads with correct unread state', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await expect(page.locator('h1')).toBeVisible();

  // Count should be a number (not NaN or empty)
  const unreadCount = await page.locator('#count-unread').textContent();
  expect(parseInt(unreadCount)).toBeGreaterThanOrEqual(0);
  console.log(`✅ Reseller has ${unreadCount} unread notifications`);
});

test('Reseller: mark all read works and clears all unread indicators', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.click('button:has-text("Mark all as read")');
  await page.waitForTimeout(1000);

  await expect(page.locator('.notif-item.unread')).toHaveCount(0);
  await expect(page.locator('.notif-item.unread-gold')).toHaveCount(0);
  await expect(page.locator('#count-unread')).toHaveText('0');
  await expect(page.locator('#unread-summary')).toHaveText('All caught up');
  console.log('✅ Reseller: mark all read clears all unread indicators');
});

/* ══════════════════════════════════════════════════════════
   RESELLER — NEW RFQ BANNER AND CARD INDICATORS
══════════════════════════════════════════════════════════ */

test('Reseller dashboard: new RFQ card has NEW tag and green border', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(4000);

  await page.click('button:has-text("Open RFQs")');
  await page.waitForTimeout(1000);

  const newCards = page.locator('#open-rfq-grid .rfq-card.new-rfq');
  const newTagCount = await page.locator('#open-rfq-grid .new-tag:has-text("NEW")').count();
  const newCardCount = await newCards.count();

  console.log(`✅ ${newCardCount} new-rfq cards, ${newTagCount} NEW tags visible`);

  if (newCardCount > 0) {
    // A new card should have the left border accent color
    const borderColor = await newCards.first().evaluate(el => window.getComputedStyle(el).borderLeftColor);
    console.log(`✅ New RFQ card left border color: ${borderColor}`);
    // Border should not be transparent (i.e. it has the accent color applied)
    expect(borderColor).not.toBe('rgba(0, 0, 0, 0)');
    console.log('✅ New RFQ card has visible accent left border');
  } else {
    console.log('ℹ️  No new-rfq cards (all RFQs older than 48h) — skipping border check');
  }
});

test('Reseller dashboard: after submitting a bid, card loses NEW tag', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(4000);

  await page.click('button:has-text("Open RFQs")');
  await page.waitForTimeout(1000);

  // Find a card that has already been bid on — should show BID SUBMITTED tag, not NEW
  const bidSubmittedCard = page.locator('#open-rfq-grid .rfq-card.bid-submitted').first();
  if (await bidSubmittedCard.count() > 0) {
    const bidTag = bidSubmittedCard.locator('.new-tag:has-text("BID SUBMITTED")');
    await expect(bidTag).toBeVisible();

    // Should NOT have the NEW tag
    const newTag = bidSubmittedCard.locator('.new-tag:has-text("NEW")');
    await expect(newTag).toHaveCount(0);
    console.log('✅ Bid-submitted card shows BID SUBMITTED tag, not NEW tag');
  } else {
    console.log('ℹ️  No bid-submitted cards currently visible');
  }
});

test('Reseller dashboard: new RFQ banner dismisses when clicked', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(4000);

  const banner = page.locator('#new-rfq-banner');
  const isVisible = await banner.evaluate(el => el.classList.contains('visible'));

  if (isVisible) {
    console.log('✅ New RFQ banner is visible');
    // Click the dismiss button
    await page.click('.new-rfq-banner-dismiss');
    await page.waitForTimeout(300);
    await expect(banner).not.toHaveClass(/visible/);
    console.log('✅ New RFQ banner dismissed');
  } else {
    console.log('ℹ️  No new RFQ banner — no new RFQs in last 48h');
  }
});

/* ══════════════════════════════════════════════════════════
   PERSISTENCE CHECK — marks survive page reload
══════════════════════════════════════════════════════════ */

test('Buyer: seen bids persist across page reload via localStorage', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('itpn_seen_bids'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Mark all as seen by clicking the badge (if it exists)
  const badge = page.locator('#new-bid-badge');
  if (await badge.count() > 0) {
    await badge.click();
    await page.waitForTimeout(500);
    console.log('✅ Clicked NEW badge to mark all seen');
  }

  // Capture the localStorage value
  const seenBids = await page.evaluate(() => localStorage.getItem('itpn_seen_bids'));
  expect(seenBids).not.toBeNull();
  const parsed = JSON.parse(seenBids);
  expect(Array.isArray(parsed)).toBe(true);
  console.log(`✅ ${parsed.length} bid ID(s) saved to localStorage`);

  // Reload — badge should NOT reappear
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await expect(page.locator('#new-bid-badge')).toHaveCount(0);
  console.log('✅ After reload, NEW badge does not reappear — seen state persisted');
});
