const { test, expect } = require('@playwright/test');

test.use({ storageState: 'auth.json' });

const BASE = 'http://localhost:3000';

test('Compare bids page loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await page.waitForTimeout(4000);

  expect(errors).toHaveLength(0);
  await expect(page.locator('#rfq-title')).toBeVisible();
  console.log('✅ Compare bids loaded without JS errors');
});

test('Buyer profile stored in window._buyerProfile after init', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await page.waitForTimeout(4000);

  const buyerProfile = await page.evaluate(() => window._buyerProfile);
  expect(buyerProfile).not.toBeNull();
  expect(buyerProfile.email).toBeTruthy();
  expect(buyerProfile.userId).toBeTruthy();
  console.log('✅ Buyer profile:', buyerProfile.name, '/', buyerProfile.email);
});

test('Reseller profiles stored in window._rpMap with contact fields', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);

  // Wait for an RFQ with bids to load
  try {
    await page.waitForSelector('.bid-card, .compare-table', { timeout: 15000 });
  } catch {
    console.log('No bids visible on this RFQ — skipping rpMap check');
    return;
  }

  await page.waitForTimeout(2000);

  const rpMap = await page.evaluate(() => window._rpMap);
  const entries = Object.values(rpMap || {});

  if (entries.length === 0) {
    console.log('No resellers in rpMap — RFQ may have no bids');
    return;
  }

  // Each entry should have contact fields (may be null if not filled in, but key must exist)
  const first = entries[0];
  expect('contact_email' in first).toBe(true);
  expect('contact_phone' in first).toBe(true);
  console.log('✅ rpMap has', entries.length, 'reseller(s), contact_email field present');
});

test('Award confirmation modal shows correct text', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);

  // Wait for bids to load
  try {
    await page.waitForSelector('.btn-award, .btn-award-sm, .drawer-btn-award', { timeout: 15000 });
  } catch {
    console.log('No award buttons visible — RFQ may be already awarded or have no bids');
    return;
  }

  // Click first award button
  const awardBtn = page.locator('.btn-award, .btn-award-sm').first();
  if (await awardBtn.count() === 0) {
    console.log('No award button found');
    return;
  }

  await awardBtn.click();
  await page.waitForTimeout(500);

  const overlay = page.locator('#award-overlay');
  await expect(overlay).toHaveClass(/open/, { timeout: 3000 });

  // Modal should mention direct contact / intro
  const modalText = await overlay.textContent();
  expect(modalText).toMatch(/contact details|introduction|reach/i);
  console.log('✅ Award modal visible with updated text');

  // Cancel without actually awarding
  await page.locator('#award-overlay .btn-cancel').click();
  await expect(overlay).not.toHaveClass(/open/);
  console.log('✅ Cancel works correctly');
});

test('Introduction overlay exists in DOM', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await page.waitForTimeout(3000);

  // Intro overlay must be in DOM (hidden by default)
  await expect(page.locator('#intro-overlay')).toBeAttached();
  const isOpen = await page.locator('#intro-overlay').evaluate(el => el.classList.contains('open'));
  expect(isOpen).toBe(false); // should be closed until award confirmed
  console.log('✅ Intro overlay in DOM and hidden by default');
});
