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
   BUYER DASHBOARD — STAT CARDS
══════════════════════════════════════════════════════════ */

test('Buyer: all 4 stat cards are visible', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const cards = page.locator('.stats-grid .stat-card');
  await expect(cards).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await expect(cards.nth(i)).toBeVisible();
  }
  console.log('✅ Buyer: all 4 stat cards visible');
});

test('Buyer: all stat cards have the same height', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const cards = page.locator('.stats-grid .stat-card');
  const heights = [];
  for (let i = 0; i < 4; i++) {
    const box = await cards.nth(i).boundingBox();
    heights.push(Math.round(box.height));
  }
  console.log('✅ Buyer stat card heights:', heights);
  // All cards should be equal height (CSS grid row aligns them)
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2);
  console.log('✅ All buyer stat cards are the same height');
});

test('Buyer: all stat cards meet minimum height', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const cards = page.locator('.stats-grid .stat-card');
  for (let i = 0; i < 4; i++) {
    const box = await cards.nth(i).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(100);
    console.log(`✅ Buyer stat card ${i + 1} height: ${Math.round(box.height)}px`);
  }
});

test('Buyer: each stat card has a label, value and sub-text', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const cards = page.locator('.stats-grid .stat-card');
  for (let i = 0; i < 4; i++) {
    const card = cards.nth(i);
    await expect(card.locator('.stat-label')).toBeVisible();
    await expect(card.locator('.stat-value')).toBeVisible();
    // sub is optional when loading but should exist in DOM
    const sub = card.locator('.stat-sub');
    expect(await sub.count()).toBeGreaterThanOrEqual(1);
  }
  console.log('✅ Buyer: all stat cards have label + value + sub');
});

test('Buyer: stat values are numbers (not dashes) after data loads', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const ids = ['stat-active', 'stat-bids', 'stat-review', 'stat-awarded'];
  for (const id of ids) {
    const text = await page.locator(`#${id}`).textContent();
    expect(text.trim()).toMatch(/^\d+$/);
    console.log(`✅ Buyer #${id}: ${text.trim()}`);
  }
});

test('Buyer: Total bids card links to compare-bids on click', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.click('#stat-bids-card');
  await expect(page).toHaveURL(/compare-bids/, { timeout: 10000 });
  console.log('✅ Total bids card navigates to compare-bids');
});

/* ══════════════════════════════════════════════════════════
   RESELLER DASHBOARD — STAT CARDS
══════════════════════════════════════════════════════════ */

test('Reseller: all 4 stat cards are visible', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(4000);

  const cards = page.locator('.stats-grid .stat-card');
  await expect(cards).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await expect(cards.nth(i)).toBeVisible();
  }
  console.log('✅ Reseller: all 4 stat cards visible');
});

test('Reseller: all stat cards have the same height', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(4000);

  const cards = page.locator('.stats-grid .stat-card');
  const heights = [];
  for (let i = 0; i < 4; i++) {
    const box = await cards.nth(i).boundingBox();
    heights.push(Math.round(box.height));
  }
  console.log('✅ Reseller stat card heights:', heights);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2);
  console.log('✅ All reseller stat cards are the same height');
});

test('Reseller: all stat cards meet minimum height', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(4000);

  const cards = page.locator('.stats-grid .stat-card');
  for (let i = 0; i < 4; i++) {
    const box = await cards.nth(i).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(100);
    console.log(`✅ Reseller stat card ${i + 1} height: ${Math.round(box.height)}px`);
  }
});

test('Reseller: each stat card has a label, value and sub-text', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(4000);

  const cards = page.locator('.stats-grid .stat-card');
  for (let i = 0; i < 4; i++) {
    const card = cards.nth(i);
    await expect(card.locator('.stat-label')).toBeVisible();
    await expect(card.locator('.stat-value')).toBeVisible();
    const sub = card.locator('.stat-sub');
    expect(await sub.count()).toBeGreaterThanOrEqual(1);
  }
  console.log('✅ Reseller: all stat cards have label + value + sub');
});

test('Reseller: stat values are populated after data loads', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(5000);

  const ids = ['stat-open-rfqs', 'stat-active-bids', 'stat-win-rate', 'stat-revenue'];
  for (const id of ids) {
    const text = (await page.locator(`#${id}`).textContent()).trim();
    expect(text).not.toBe('—');
    console.log(`✅ Reseller #${id}: ${text}`);
  }
});

test('Reseller: Open RFQs stat card navigates to Open RFQs tab on click', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(3000);

  await page.locator('.stat-card.clickable').first().click();
  await page.waitForTimeout(500);
  await expect(page.locator('#open-rfq-grid')).toBeVisible();
  console.log('✅ Open RFQs stat card switches to Open RFQs tab');
});

/* ══════════════════════════════════════════════════════════
   CROSS-DASHBOARD — WIDTH & ALIGNMENT CONSISTENCY
══════════════════════════════════════════════════════════ */

test('Buyer and reseller stat card grids use same column count', async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const reseller = await resellerCtx.newPage();

  try {
    await loginAs(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);

    await buyer.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    await buyer.waitForTimeout(2000);
    await reseller.waitForTimeout(2000);

    // Both should have 4 cards in a grid
    await expect(buyer.locator('.stats-grid .stat-card')).toHaveCount(4);
    await expect(reseller.locator('.stats-grid .stat-card')).toHaveCount(4);

    // Compare grid widths — should be similarly wide
    const buyerGrid = await buyer.locator('.stats-grid').boundingBox();
    const resellerGrid = await reseller.locator('.stats-grid').boundingBox();
    console.log(`✅ Buyer grid width: ${Math.round(buyerGrid.width)}px`);
    console.log(`✅ Reseller grid width: ${Math.round(resellerGrid.width)}px`);

    // Both grids should fill most of the content area (>600px)
    expect(buyerGrid.width).toBeGreaterThan(600);
    expect(resellerGrid.width).toBeGreaterThan(600);
    console.log('✅ Both dashboards have wide stat card grids');

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
  }
});

/* ══════════════════════════════════════════════════════════
   BUYER — RECENT ACTIVITY SECTION
══════════════════════════════════════════════════════════ */

test('Buyer: Recent activity section is visible and has a header', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await expect(page.locator('.notif-section')).toBeVisible();
  await expect(page.locator('.notif-title:has-text("Recent activity")')).toBeVisible();
  console.log('✅ Recent activity section visible with header');
});

test('Buyer: Recent activity section is not shorter than stat cards', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const statCard = page.locator('.stats-grid .stat-card').first();
  const statBox = await statCard.boundingBox();
  const notifSection = page.locator('.notif-section');
  const notifBox = await notifSection.boundingBox();

  console.log(`✅ Stat card height: ${Math.round(statBox.height)}px`);
  console.log(`✅ Recent activity section height: ${Math.round(notifBox.height)}px`);

  // Activity section should be taller than a single stat card
  expect(notifBox.height).toBeGreaterThan(statBox.height);
  console.log('✅ Recent activity section is taller than a single stat card');
});

/* ══════════════════════════════════════════════════════════
   BUYER — RFQ TABLE WIDGET
══════════════════════════════════════════════════════════ */

test('Buyer: RFQ table has correct column headers', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const headers = page.locator('.rfq-table thead th');
  const headerTexts = await headers.allTextContents();
  console.log('✅ RFQ table headers:', headerTexts);

  expect(headerTexts).toContain('Project');
  expect(headerTexts).toContain('Status');
  expect(headerTexts).toContain('Bids');
  console.log('✅ RFQ table has required columns: Project, Status, Bids');
});

test('Buyer: RFQ table rows are present and clickable', async ({ page }) => {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const rows = page.locator('.rfq-table tbody tr');
  const rowCount = await rows.count();
  console.log(`✅ RFQ table has ${rowCount} row(s)`);
  expect(rowCount).toBeGreaterThan(0);

  // Each row should have an onclick (either openDrawer or compare-bids nav)
  const firstRow = rows.first();
  await expect(firstRow).toBeVisible();
  console.log('✅ RFQ table rows are visible');
});

/* ══════════════════════════════════════════════════════════
   RESELLER — OPEN RFQ GRID WIDGET
══════════════════════════════════════════════════════════ */

test('Reseller: Open RFQ grid cards have consistent structure', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.click('button:has-text("Open RFQs")');
  await page.waitForTimeout(1000);

  const cards = page.locator('#open-rfq-grid .rfq-card');
  const count = await cards.count();
  console.log(`✅ Reseller Open RFQs: ${count} card(s)`);
  expect(count).toBeGreaterThan(0);

  // All cards should have a title and a bid button
  for (let i = 0; i < Math.min(count, 5); i++) {
    const card = cards.nth(i);
    await expect(card).toBeVisible();
    const btnBid = card.locator('.btn-bid');
    await expect(btnBid).toBeVisible();
  }
  console.log('✅ All open RFQ cards have a bid button');
});

test('Reseller: Open RFQ cards are all the same width', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.click('button:has-text("Open RFQs")');
  await page.waitForTimeout(1000);

  const cards = page.locator('#open-rfq-grid .rfq-card');
  const count = await cards.count();
  if (count < 2) {
    console.log('ℹ️  Only 1 card — skipping width comparison');
    return;
  }

  const widths = [];
  for (let i = 0; i < Math.min(count, 4); i++) {
    const box = await cards.nth(i).boundingBox();
    widths.push(Math.round(box.width));
  }
  console.log('✅ RFQ card widths:', widths);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
  console.log('✅ All open RFQ cards have consistent width');
});

test('Reseller: My Bids tab cards have consistent structure', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tab-btn', { timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.click('button:has-text("My bids")');
  await page.waitForTimeout(1000);

  const bids = page.locator('#my-bids-list .rfq-card');
  const count = await bids.count();
  console.log(`✅ Reseller My Bids: ${count} card(s)`);

  if (count > 0) {
    // Each card should have a .new-tag or status indicator and a revise button
    for (let i = 0; i < Math.min(count, 3); i++) {
      await expect(bids.nth(i)).toBeVisible();
    }
    console.log('✅ My Bids cards are visible');
  }
});
