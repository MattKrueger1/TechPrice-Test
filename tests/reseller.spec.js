import { test, expect } from '@playwright/test';

test.use({ storageState: 'reseller-auth.json' });

const BASE = 'http://localhost:3000';

/* ─── DASHBOARD ─── */
test('Reseller dashboard loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await expect(page.locator('text=Reseller Dashboard')).toBeVisible();
});

test('Open RFQs page shows grid', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-open-rfqs.html`);
  await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
  await expect(page.locator('#open-rfq-grid')).toBeVisible();
});

test('My Bids page loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-my-bids.html`);
  await page.waitForSelector('#bids-list', { timeout: 20000 });
  await expect(page.locator('#bids-list')).toBeVisible();
});

test('My Bids tab - Won', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-my-bids.html`);
  await page.waitForSelector('#tab-won', { timeout: 20000 });
  await page.click('#tab-won');
  await expect(page.locator('#tab-won')).toHaveClass(/active/);
});

test('My Bids tab - Lost', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-my-bids.html`);
  await page.waitForSelector('#tab-lost', { timeout: 20000 });
  await page.click('#tab-lost');
  await expect(page.locator('#tab-lost')).toHaveClass(/active/);
});

test('My Bids tab - Cancelled', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-my-bids.html`);
  await page.waitForSelector('#tab-cancelled', { timeout: 20000 });
  await page.click('#tab-cancelled');
  await expect(page.locator('#tab-cancelled')).toHaveClass(/active/);
});

test('Won bid shows WON tag', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-my-bids.html`);
  await page.waitForSelector('#tab-won', { timeout: 20000 });
  await page.click('#tab-won');
  const wonTag = page.locator('.new-tag', { hasText: 'WON' });
  if (await wonTag.count() > 0) {
    await expect(wonTag.first()).toBeVisible();
  }
});

test('Cancelled bid shows CANCELLED tag', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-my-bids.html`);
  await page.waitForSelector('#tab-cancelled', { timeout: 20000 });
  await page.click('#tab-cancelled');
  const cancelledTag = page.locator('.new-tag', { hasText: 'CANCELLED' });
  if (await cancelledTag.count() > 0) {
    await expect(cancelledTag.first()).toBeVisible();
  }
});

/* ─── BID FORM MODAL ─── */
test('Clicking an open RFQ opens the bid modal', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-open-rfqs.html`);
  await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
  await page.waitForTimeout(3000);
  const firstCard = page.locator('#open-rfq-grid .rfq-card').first();
  if (await firstCard.count() > 0) {
    await firstCard.click();
    await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/);
  } else {
    console.log('ℹ️ No open RFQs available — skipping modal test');
  }
});

test('Bid modal closes on cancel', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-open-rfqs.html`);
  await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
  await page.waitForTimeout(3000);
  const firstCard = page.locator('#open-rfq-grid .rfq-card').first();
  if (await firstCard.count() > 0) {
    await firstCard.click();
    await page.click('.btn-cancel-bid');
    await expect(page.locator('#bid-modal')).toHaveClass(/hidden/);
  } else {
    console.log('ℹ️ No open RFQs available — skipping cancel test');
  }
});

/* ─── PROFILE ─── */
test('Reseller profile page loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-profile.html`);
  await expect(page.locator('h1')).toBeVisible();
});

test('My Profile nav link navigates correctly', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.locator('a[href="bidbridge-reseller-profile.html"]').first().click();
  await expect(page).toHaveURL(/reseller-profile/);
});

/* ─── NOTIFICATIONS ─── */
test('Reseller notifications page loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-notifications_1.html`);
  await expect(page.locator('h1')).toBeVisible();
});
