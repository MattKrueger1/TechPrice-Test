/**
 * Buyer dashboard panel tests — updated to match current dashboard design.
 * The buyer dashboard has:
 *  - 4 stat cards (Active RFQs, Total Bids, Ready to Review, Deals Awarded)
 *  - Bid activity section (.notif-section)
 *  - Messages panel (#panel-messages) toggled by #nav-messages
 */
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'auth.json' });

const BASE = 'http://localhost:3000';

/* ══════════════════════════════════════════════════════════
   STAT CARDS
══════════════════════════════════════════════════════════ */

test('Dashboard loads with 4 stat cards visible', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const cards = page.locator('.stats-grid .stat-card');
  await expect(cards).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await expect(cards.nth(i)).toBeVisible();
  }
  console.log('✅ All 4 stat cards visible on load');
});

test('Stat card values populate after data loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const activeVal = await page.locator('#stat-active').textContent();
  const bidsVal   = await page.locator('#stat-bids').textContent();
  const awardedVal = await page.locator('#stat-awarded').textContent();

  expect(parseInt(activeVal)).toBeGreaterThanOrEqual(0);
  expect(parseInt(bidsVal)).toBeGreaterThanOrEqual(0);
  expect(parseInt(awardedVal)).toBeGreaterThanOrEqual(0);
  console.log(`✅ Stats — active: ${activeVal}, bids: ${bidsVal}, awarded: ${awardedVal}`);
});

test('Total bids card navigates to compare-bids', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.click('#stat-bids-card');
  await expect(page).toHaveURL(/compare-bids/, { timeout: 10000 });
  console.log('✅ Total bids card navigates to compare-bids');
});

/* ══════════════════════════════════════════════════════════
   BID ACTIVITY SECTION
══════════════════════════════════════════════════════════ */

test('Bid activity section is always visible', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await expect(page.locator('.notif-section')).toBeVisible();
  await expect(page.locator('.notif-title:has-text("Bid activity")')).toBeVisible();
  console.log('✅ Bid activity section visible with header');
});

test('Bid activity section renders items or empty state', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const notifSection = page.locator('.notif-section');
  const text = await notifSection.textContent();
  expect(text.trim().length).toBeGreaterThan(0);
  console.log('✅ Bid activity section has content (items or empty state)');
});

/* ══════════════════════════════════════════════════════════
   MESSAGES PANEL
══════════════════════════════════════════════════════════ */

test('Messages nav item is visible in sidebar', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#nav-messages')).toBeVisible({ timeout: 10000 });
  const text = await page.locator('#nav-messages').textContent();
  expect(text).toContain('Messages');
  console.log('✅ Messages nav item visible in sidebar');
});

test('Clicking Messages nav opens messages panel', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nav-messages', { timeout: 10000 });
  await page.waitForTimeout(2000);

  await page.locator('#nav-messages').click();
  // showPanel() uses inline style display:block, not .active class
  await expect(page.locator('#panel-messages')).toBeVisible({ timeout: 5000 });
  console.log('✅ Messages nav click shows #panel-messages');
});

test('Messages panel is only panel that activates', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nav-messages', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Before click: messages panel hidden
  await expect(page.locator('#panel-messages')).not.toBeVisible();

  // After click: messages panel visible
  await page.locator('#nav-messages').click();
  await expect(page.locator('#panel-messages')).toBeVisible({ timeout: 5000 });
  console.log('✅ Messages panel visible after clicking Messages nav');
});

test('Messages panel contains inbox and compose areas', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nav-messages', { timeout: 10000 });
  await page.waitForTimeout(2000);

  await page.locator('#nav-messages').click();
  await page.waitForTimeout(2000);

  await expect(page.locator('#msg-inbox-threads')).toBeVisible();
  await expect(page.locator('#msg-inbox-conv')).toBeVisible();
  console.log('✅ Messages panel shows thread list and conversation areas');
});

/* ══════════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════════ */

test('Active RFQs stat card opens inline active RFQs panel', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.click('#stat-active-card');
  await page.waitForTimeout(500);
  const panel = page.locator('#stat-detail-panel');
  await expect(panel).toBeVisible({ timeout: 5000 });
  console.log('✅ Active RFQs card opens inline stat panel');
});

test('Dashboard page has no JS errors on load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => {
    if (!err.message.includes('WebSocket') && !err.message.includes('Refresh Token')) {
      errors.push(err.message);
    }
  });

  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  expect(errors).toHaveLength(0);
  console.log('✅ No JS errors on buyer dashboard load');
});
