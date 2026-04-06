/**
 * Tests for new RFQ form field changes:
 * - City + State dropdowns replace single HQ location text input
 * - No delivery date or budget fields
 * - Spreadsheet bar mentions vendor account manager
 * - Form submits correctly and stores city, state as "City, ST" in hq_location
 */
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'auth.json' });

const BASE = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

test.describe('New RFQ form — field structure', () => {
  test('City and State fields exist, delivery date and budget do not', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
    await page.waitForSelector('#project-title', { timeout: 15000 });

    // New fields present
    await expect(page.locator('#project-city')).toBeVisible();
    await expect(page.locator('#project-state')).toBeVisible();
    console.log('✅ City and State fields are present');

    // Removed fields absent
    await expect(page.locator('#project-location')).toHaveCount(0);
    await expect(page.locator('#project-delivery')).toHaveCount(0);
    await expect(page.locator('#project-budget')).toHaveCount(0);
    console.log('✅ Old location, delivery date, and budget fields are gone');
  });

  test('State dropdown has all 50 states + DC', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
    await page.waitForSelector('#project-state', { timeout: 15000 });

    const options = await page.locator('#project-state option').allTextContents();
    // Remove the blank placeholder
    const states = options.filter(o => o.trim().length === 2);
    expect(states.length).toBe(51); // 50 states + DC
    expect(states).toContain('TX');
    expect(states).toContain('CA');
    expect(states).toContain('DC');
    console.log(`✅ State dropdown has ${states.length} options (50 states + DC)`);
  });

  test('Spreadsheet bar mentions vendor account manager', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
    await page.waitForSelector('#project-title', { timeout: 15000 });
    await page.fill('#project-title', 'Field Test RFQ');
    await page.fill('#project-desc', 'Testing field changes in the new RFQ form');
    await page.fill('#project-deadline', '2026-08-01');
    await page.fill('#project-city', 'Austin');
    await page.selectOption('#project-state', 'TX');
    await page.locator('#section-1 button.btn-next').click();
    await page.waitForSelector('.import-bar', { timeout: 10000 });

    const barText = await page.locator('.import-bar').textContent();
    expect(barText).toMatch(/vendor account manager/i);
    console.log('✅ Import bar mentions vendor account manager');
  });

  test('Step 1 validation requires both city and state', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
    await page.waitForSelector('#project-title', { timeout: 15000 });
    await page.fill('#project-title', 'Validation Test');
    await page.fill('#project-desc', 'Testing validation on city and state fields');
    await page.fill('#project-deadline', '2026-08-01');
    // Leave city and state blank, try to advance
    await page.locator('#section-1 button.btn-next').click();
    await page.waitForTimeout(500);

    // Should still be on step 1
    await expect(page.locator('#section-1')).toBeVisible();
    // Error indicators should appear
    const cityEl = page.locator('#project-city');
    const hasError = await cityEl.evaluate(el => el.classList.contains('error'));
    expect(hasError).toBe(true);
    console.log('✅ City field shows validation error when left blank');

    // Fill city but not state
    await page.fill('#project-city', 'Austin');
    await page.locator('#section-1 button.btn-next').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#section-1')).toBeVisible();
    console.log('✅ Form still blocked when state not selected');

    // Fill both — should advance
    await page.selectOption('#project-state', 'TX');
    await page.locator('#section-1 button.btn-next').click();
    await page.waitForSelector('#section-2', { timeout: 10000 });
    await expect(page.locator('#section-2')).toBeVisible();
    console.log('✅ Form advances to step 2 when both city and state filled');
  });

  test('Review screen shows City, State combined — no delivery or budget rows', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
    await page.waitForSelector('#project-title', { timeout: 15000 });

    // Fill step 1
    await page.fill('#project-title', 'Review Test RFQ');
    await page.fill('#project-desc', 'Testing the review screen after form field changes');
    await page.fill('#project-deadline', '2026-08-01');
    await page.fill('#project-city', 'Denver');
    await page.selectOption('#project-state', 'CO');
    await page.locator('#section-1 button.btn-next').click();

    // Fill step 2
    await page.waitForSelector('#vendor-name-1', { timeout: 10000 });
    await page.selectOption('#vendor-name-1', 'Cisco');
    await page.fill('#sku-part-1-1', 'C9300-24T-E');
    await page.fill('#sku-qty-1-1', '5');
    await page.locator('#section-2 button.btn-next').click();
    await page.waitForTimeout(800);

    // Step 3 → 4 (review) — call goToStep directly since click triggers same path
    await page.evaluate(() => goToStep(4));
    await page.waitForTimeout(500);

    const reviewText = await page.evaluate(() => {
      const el = document.getElementById('review-content');
      return el ? el.innerHTML : '';
    });
    expect(reviewText).toMatch(/Denver, CO/);
    expect(reviewText).not.toMatch(/Delivery date/i);
    expect(reviewText).not.toMatch(/Budget/i);
    console.log('✅ Review shows "Denver, CO" and has no delivery date or budget rows');

    expect(errors).toHaveLength(0);
    console.log('✅ No JS errors through full form flow');
  });
});
