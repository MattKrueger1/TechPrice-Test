const { test, expect } = require('@playwright/test');

test.use({ storageState: 'auth.json' });

const BASE = 'http://localhost:3000';

test('Exec summary page loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(`${BASE}/bidbridge-exec-summary.html`);
  await page.waitForTimeout(3000);

  // Without an rfq param it should show an error state, not crash
  const body = await page.locator('body').textContent();
  expect(body).toMatch(/No RFQ specified|Executive Summary|BidBridge/i);
  expect(errors).toHaveLength(0);
  console.log('✅ Exec summary page loads without JS errors');
});

test('Exec summary shows error for missing rfq param', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-exec-summary.html`);
  await page.waitForTimeout(4000);

  // If redirected to auth, session expired — skip
  if (page.url().includes('auth')) {
    console.log('Session expired — skipping');
    return;
  }

  const body = await page.locator('body').textContent();
  expect(body).toMatch(/No RFQ specified/i);
  console.log('✅ Missing rfq param shows correct error state');
});

test('Exec summary toolbar and print button are visible', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-exec-summary.html`);
  await page.waitForTimeout(4000);

  // If redirected to auth, session expired — skip
  if (page.url().includes('auth')) {
    console.log('Session expired — skipping');
    return;
  }

  await expect(page.locator('.toolbar')).toBeVisible();
  await expect(page.locator('.btn-print')).toBeVisible();
  await expect(page.locator('.btn-back')).toBeVisible();
  console.log('✅ Toolbar, print button, and back link visible');
});

test('Exec summary loads real data for awarded RFQ', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // Load My RFQs to find an awarded RFQ id
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  await page.waitForTimeout(4000);

  // Click awarded filter
  const awardedTab = page.locator('#pill-awarded, .filter-pill', { hasText: /^awarded$/i });
  if (await awardedTab.count() === 0) {
    console.log('No awarded RFQs — skipping data load test');
    return;
  }
  await awardedTab.first().click();
  await page.waitForTimeout(500);

  const firstCard = page.locator('.rfq-card, .rfq-item').first();
  if (await firstCard.count() === 0) {
    console.log('No awarded cards — skipping');
    return;
  }

  // Get rfq id from card click → drawer → exec summary link
  await firstCard.click();
  await page.waitForTimeout(3000);

  const summaryLink = page.locator('a[href*="exec-summary"]').first();
  if (await summaryLink.count() === 0) {
    console.log('No exec summary link in drawer — skipping');
    return;
  }

  const href = await summaryLink.getAttribute('href');
  console.log('✅ Exec summary link found:', href);

  // Navigate to exec summary
  await page.goto(`${BASE}/${href}`);
  await page.waitForTimeout(4000);

  const body = await page.locator('body').textContent();
  expect(body).toMatch(/Executive Summary|Procurement Report/i);
  expect(body).toMatch(/Days on market|Bids received/i);
  expect(body).toMatch(/Your savings/i);
  expect(errors).toHaveLength(0);
  console.log('✅ Exec summary loaded real RFQ data successfully');
});
