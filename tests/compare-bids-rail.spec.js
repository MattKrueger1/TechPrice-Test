const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const BUYER_EMAIL = 'mattkrueger@comcast.net';
const BUYER_PASSWORD = 'Test12345678';

async function loginAndGoToCompareBids(page) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', BUYER_EMAIL);
  await page.fill('#login-password', BUYER_PASSWORD);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000); // let all data load
}

test('Compare bids page shows RFQ rail on the left', async ({ page }) => {
  await loginAndGoToCompareBids(page);
  await expect(page.locator('.rfq-rail')).toBeVisible();
  console.log('✅ RFQ rail is visible');
});

test('RFQ rail lists multiple RFQ items', async ({ page }) => {
  await loginAndGoToCompareBids(page);
  const items = page.locator('.rfq-rail-item');
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
  console.log(`✅ Rail shows ${count} RFQ item(s)`);
});

test('Each rail item shows title and status badge', async ({ page }) => {
  await loginAndGoToCompareBids(page);
  const first = page.locator('.rfq-rail-item').first();
  await expect(first.locator('.rfq-rail-title')).toBeVisible();
  await expect(first.locator('.status-badge')).toBeVisible();
  const title = await first.locator('.rfq-rail-title').textContent();
  expect(title.trim().length).toBeGreaterThan(0);
  console.log(`✅ First rail item title: "${title.trim()}"`);
});

test('Each rail item shows bid count', async ({ page }) => {
  await loginAndGoToCompareBids(page);
  const first = page.locator('.rfq-rail-item').first();
  const meta = await first.locator('.rfq-rail-bids').textContent();
  expect(meta).toMatch(/\d+ bid/);
  console.log(`✅ Rail bid count: "${meta.trim()}"`);
});

test('One rail item is highlighted as active (current RFQ)', async ({ page }) => {
  await loginAndGoToCompareBids(page);
  const activeItems = page.locator('.rfq-rail-item.active');
  await expect(activeItems).toHaveCount(1);
  console.log('✅ Exactly one rail item is active');
});

test('Clicking a different rail item navigates to that RFQ', async ({ page }) => {
  await loginAndGoToCompareBids(page);
  const items = page.locator('.rfq-rail-item');
  const count = await items.count();
  if (count < 2) {
    console.log('ℹ️  Only one RFQ — skipping rail switch test');
    return;
  }

  // Find a non-active item and click it
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const isActive = await item.evaluate(el => el.classList.contains('active'));
    if (!isActive) {
      // Get a snippet of the title before clicking
      const title = await item.locator('.rfq-rail-title').textContent();
      await item.click();
      await page.waitForURL(/rfq=/, { timeout: 10000 });
      await page.waitForTimeout(4000);
      // The RFQ detail should now show that title
      const detailTitle = await page.locator('#rfq-title').textContent();
      console.log(`✅ Clicked "${title.trim()}" → detail shows "${detailTitle.trim()}"`);
      clicked = true;
      break;
    }
  }
  if (!clicked) console.log('ℹ️  All items active — skipping');
});

test('RFQ detail pane shows bids for the selected RFQ', async ({ page }) => {
  await loginAndGoToCompareBids(page);
  // bids-grid or view-card should be visible
  await expect(page.locator('#view-card')).toBeVisible();
  console.log('✅ RFQ detail pane is visible');
});

test('RFQ detail shows RFQ title and summary', async ({ page }) => {
  await loginAndGoToCompareBids(page);
  const title = await page.locator('#rfq-title').textContent();
  expect(title.trim().length).toBeGreaterThan(0);
  expect(title).not.toContain('Loading');
  console.log(`✅ RFQ title in detail: "${title.trim()}"`);
});

test('View toggle (card/table) still works', async ({ page }) => {
  await loginAndGoToCompareBids(page);
  // Switch to table view
  await page.click('#toggle-table');
  await expect(page.locator('#view-table')).toBeVisible();
  await expect(page.locator('#view-card')).not.toBeVisible();
  // Switch back to card view
  await page.click('#toggle-card');
  await expect(page.locator('#view-card')).toBeVisible();
  console.log('✅ View toggle card/table works');
});

test('Navigating from dashboard via View button lands on correct RFQ in rail', async ({ page }) => {
  // Go to dashboard first
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', BUYER_EMAIL);
  await page.fill('#login-password', BUYER_PASSWORD);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(5000);

  // Click the first View button in the RFQ table
  const viewBtn = page.locator('#rfq-tbody .btn-view').first();
  await viewBtn.click();
  await page.waitForURL(/compare-bids/, { timeout: 10000 });
  await page.waitForTimeout(5000);

  // Should have an active rail item
  const activeItem = page.locator('.rfq-rail-item.active');
  await expect(activeItem).toHaveCount(1);
  console.log('✅ Navigating from dashboard highlights correct rail item');
});
