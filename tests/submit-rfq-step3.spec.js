const { test, expect } = require('@playwright/test');
test.use({ storageState: 'auth.json' });
const BASE = 'http://localhost:3000';

test('Step 3 loads without JS errors and shows plain-English labels', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
  await page.waitForTimeout(3000);

  // Fill step 1 and advance
  await page.fill('#project-title', 'Test RFQ');
  await page.fill('#project-desc', 'A test project description for step navigation');
  await page.fill('#project-deadline', '2026-06-01');
  await page.fill('#project-city', 'Boston');
  await page.selectOption('#project-state', 'MA');
  await page.locator('#section-1 button.btn-next').click();
  await page.waitForTimeout(500);

  // Step 2: vendor + SKU
  const vendorSelect = page.locator('select[id^="vendor-name-"]').first();
  await vendorSelect.selectOption('Cisco');
  await page.fill('input[id^="sku-part-"]', 'C9300-48P-A');
  await page.fill('input[id^="sku-qty-"]', '5');
  await page.locator('#section-2 button.btn-next').click();
  await page.waitForTimeout(500);

  // Now on step 3
  const step3 = page.locator('#section-3');
  await expect(step3).toBeVisible();
  const text = await step3.textContent();

  expect(text).toMatch(/How should resellers bid/i);
  expect(text).toMatch(/One reseller bids everything/i);
  expect(text).toMatch(/Who can bid/i);
  expect(text).toMatch(/RECOMMENDED/i);
  console.log('✅ Step 3 shows plain-English labels');

  await expect(page.locator('#card-sole')).toContainText('RECOMMENDED');
  console.log('✅ Recommended badge present');

  expect(text).not.toMatch(/coming soon/i);
  console.log('✅ No "coming soon" options');

  await expect(page.locator('#tier-options')).toBeHidden();
  console.log('✅ Tier options hidden by default');

  await page.locator("label.toggle-switch").click();
  await expect(page.locator('#tier-options')).toBeVisible();
  expect(await page.locator('.tier-pill.selected').count()).toBe(0);
  console.log('✅ No tier pre-selected when toggle turns on');

  expect(errors).toHaveLength(0);
  console.log('✅ No JS errors');
});
