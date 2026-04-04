import { test, expect } from '@playwright/test';

test.use({ storageState: 'auth.json' });

const BASE = 'http://localhost:3000';

test('Buyer dashboard loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await expect(page.locator('h1')).toBeVisible();
});

test('My RFQs page loads and shows RFQs', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  await expect(page.locator('h1')).toBeVisible();
});

test('View bids button navigates to compare-bids', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  await page.click('button:has-text("View bids")');
  await expect(page).toHaveURL(/compare-bids/);
});

test('Compare bids page loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await expect(page.locator('#rfq-title')).toBeVisible();
});

test('Notifications page loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-notifications_1.html`);
  await expect(page.locator('h1')).toBeVisible();
});
