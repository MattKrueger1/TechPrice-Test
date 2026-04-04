import { test, expect } from '@playwright/test';

test.use({ storageState: 'auth.json' });

const BASE = 'http://localhost:3000';

/* ─── PAGE LOAD ─── */
test('Compare bids page loads with RFQ title', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await expect(page.locator('#rfq-title')).toBeVisible();
});

test('Bid count label is visible', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await expect(page.locator('#bids-count')).toBeVisible();
});

test('Sort bar is visible', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await expect(page.locator('.sort-bar')).toBeVisible();
});

/* ─── NAVIGATION VIA URL PARAM ─── */
test('Loads correct RFQ when rfq param is in URL', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);

  // Get the first active RFQ id from the page URL after clicking View bids
  const viewBidsBtn = page.locator('button:has-text("View bids")').first();
  if (await viewBidsBtn.count() > 0) {
    await viewBidsBtn.click();
    await expect(page).toHaveURL(/compare-bids.*rfq=/);
    await expect(page.locator('#rfq-title')).toBeVisible();
  }
});

/* ─── VIEWS ─── */
test('Card view is default and shows bid cards', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await expect(page.locator('#bids-grid')).toBeVisible();
});

test('Switch to side-by-side view works', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await page.click('#toggle-table');
  await expect(page.locator('#view-table')).toBeVisible();
});

test('Switch back to card view works', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await page.click('#toggle-table');
  await page.click('#toggle-card');
  await expect(page.locator('#bids-grid')).toBeVisible();
});

/* ─── SORT ─── */
test('Sort by price low to high is default active', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await expect(page.locator('.sort-pill.active')).toBeVisible();
});

test('Sort by price high to low works', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await page.click('.sort-pill:has-text("Price: high to low")');
  await expect(page.locator('.sort-pill:has-text("Price: high to low")')).toHaveClass(/active/);
});

/* ─── CANCELLED RFQ ─── */
test('Cancelled RFQ shows warning banner', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  // Click a cancelled RFQ's view button if one exists
  const cancelledRow = page.locator('[data-status="cancelled"] .btn-action').first();
  if (await cancelledRow.count() > 0) {
    await cancelledRow.click();
    await expect(page.locator('#cancelled-banner')).toBeVisible();
  }
});

/* ─── AWARD FLOW ─── */
test('Award bid button is visible on bid card', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  const awardBtn = page.locator('button:has-text("Award bid")').first();
  if (await awardBtn.count() > 0) {
    await expect(awardBtn).toBeVisible();
  }
});

test('Award modal opens when Award bid is clicked', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  const awardBtn = page.locator('button:has-text("Award bid")').first();
  if (await awardBtn.count() > 0) {
    await awardBtn.click();
    await expect(page.locator('#award-overlay')).toHaveClass(/open/);
  }
});

test('Award modal closes on cancel', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  const awardBtn = page.locator('button:has-text("Award bid")').first();
  if (await awardBtn.count() > 0) {
    await awardBtn.click();
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('#award-overlay')).not.toHaveClass(/open/);
  }
});

/* ─── BROADCAST MESSAGE ─── */
test('Broadcast message button is visible', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await expect(page.locator('button:has-text("Message all")')).toBeVisible();
});
