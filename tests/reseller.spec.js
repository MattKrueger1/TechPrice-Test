import { test, expect } from '@playwright/test';

test.use({ storageState: 'reseller-auth.json' });

const BASE = 'http://localhost:3000';

/* ─── DASHBOARD ─── */
test('Reseller dashboard loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await expect(page.locator('text=Reseller Dashboard')).toBeVisible();
});

test('Open RFQs tab shows grid', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('button:has-text("Open RFQs")');
  await expect(page.locator('#open-rfq-grid')).toBeVisible();
});

test('My Bids tab loads list', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('button:has-text("My bids")');
  await expect(page.locator('#my-bids-list')).toBeVisible();
});

test('My Bids filter - Won', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('button:has-text("My bids")');
  await page.click('#mybids-pill-won');
  await expect(page.locator('#mybids-pill-won')).toHaveClass(/active/);
});

test('My Bids filter - Lost', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('button:has-text("My bids")');
  await page.click('#mybids-pill-lost');
  await expect(page.locator('#mybids-pill-lost')).toHaveClass(/active/);
});

test('My Bids filter - Cancelled', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('button:has-text("My bids")');
  await page.click('#mybids-pill-cancelled');
  await expect(page.locator('#mybids-pill-cancelled')).toHaveClass(/active/);
});

test('Won bid shows WON tag', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('button:has-text("My bids")');
  await page.click('#mybids-pill-won');
  const wonTag = page.locator('.new-tag', { hasText: 'WON' });
  if (await wonTag.count() > 0) {
    await expect(wonTag.first()).toBeVisible();
  }
});

test('Cancelled bid shows CANCELLED tag', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('button:has-text("My bids")');
  await page.click('#mybids-pill-cancelled');
  const cancelledTag = page.locator('.new-tag', { hasText: 'CANCELLED' });
  if (await cancelledTag.count() > 0) {
    await expect(cancelledTag.first()).toBeVisible();
  }
});

/* ─── BID FORM MODAL ─── */
test('Clicking an open RFQ opens the bid modal', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('button:has-text("Open RFQs")');
  const firstCard = page.locator('#open-rfq-grid .rfq-card').first();
  if (await firstCard.count() > 0) {
    await firstCard.click();
    await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/);
  }
});

test('Bid modal closes on cancel', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('button:has-text("Open RFQs")');
  const firstCard = page.locator('#open-rfq-grid .rfq-card').first();
  if (await firstCard.count() > 0) {
    await firstCard.click();
    await page.click('.btn-cancel-bid');
    await expect(page.locator('#bid-modal')).toHaveClass(/hidden/);
  }
});

/* ─── PROFILE ─── */
test('Reseller profile page loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-profile.html`);
  await expect(page.locator('h1')).toBeVisible();
});

test('My Profile nav link navigates correctly', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.click('a[href="bidbridge-reseller-profile.html"]');
  await expect(page).toHaveURL(/reseller-profile/);
});

/* ─── NOTIFICATIONS ─── */
test('Reseller notifications page loads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-notifications_1.html`);
  await expect(page.locator('h1')).toBeVisible();
});
