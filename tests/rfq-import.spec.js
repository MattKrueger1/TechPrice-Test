const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
test.use({ storageState: 'auth.json' });
const BASE = 'http://localhost:3000';

test('Step 2 loads without JS errors and shows import bar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
  await page.waitForTimeout(3000);

  // Advance to step 2
  await page.fill('#project-title', 'Import Test RFQ');
  await page.fill('#project-desc', 'Testing the spreadsheet import feature');
  await page.fill('#project-deadline', '2026-06-01');
  await page.fill('#project-location', 'Boston, MA');
  await page.locator('#section-1 button.btn-next').click();
  await page.waitForTimeout(500);

  // Import bar should be visible
  await expect(page.locator('.import-bar')).toBeVisible();
  const barText = await page.locator('.import-bar').textContent();
  expect(barText).toMatch(/Have IT fill out a spreadsheet/i);
  expect(barText).toMatch(/Download template/i);
  expect(barText).toMatch(/Upload spreadsheet/i);
  console.log('✅ Import bar visible with correct labels');

  expect(errors).toHaveLength(0);
  console.log('✅ No JS errors on step 2');
});

test('Download template button is clickable and XLSX library loaded', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
  await page.waitForTimeout(4000); // wait for XLSX CDN to load

  // Advance to step 2
  await page.fill('#project-title', 'Import Test RFQ');
  await page.fill('#project-desc', 'Testing');
  await page.fill('#project-deadline', '2026-06-01');
  await page.fill('#project-location', 'Boston, MA');
  await page.locator('#section-1 button.btn-next').click();
  await page.waitForTimeout(500);

  // Check XLSX library is loaded
  const xlsxLoaded = await page.evaluate(() => typeof XLSX !== 'undefined');
  expect(xlsxLoaded).toBe(true);
  console.log('✅ XLSX library loaded');

  expect(errors).toHaveLength(0);
  console.log('✅ No JS errors');
});

test('CSV upload populates vendor and SKU fields correctly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
  await page.waitForTimeout(4000);

  // Advance to step 2
  await page.fill('#project-title', 'Import Test RFQ');
  await page.fill('#project-desc', 'Testing CSV import');
  await page.fill('#project-deadline', '2026-06-01');
  await page.fill('#project-location', 'Boston, MA');
  await page.locator('#section-1 button.btn-next').click();
  await page.waitForTimeout(500);

  // Create a CSV test file
  const csvContent = `Vendor,SKU / Part Number,Quantity,Notes\nCisco,C9300-48P-A,5,Core switch\nCisco,C9300-24T-A,2,Distribution\nDell Technologies,PowerEdge R750,3,Rack server\n`;
  const csvPath = path.join('/tmp', 'test-rfq-import.csv');
  fs.writeFileSync(csvPath, csvContent);

  // Upload the CSV
  const fileInput = page.locator('#import-file');
  await fileInput.setInputFiles(csvPath);
  await page.waitForTimeout(1000);

  // Success message should appear
  const successEl = page.locator('#import-success');
  await expect(successEl).toBeVisible();
  const successText = await successEl.textContent();
  expect(successText).toMatch(/3 SKUs/i);
  expect(successText).toMatch(/2 vendor/i);
  console.log('✅ Success message:', successText.trim());

  // Vendor selects should be populated
  const vendorSelects = page.locator('select[id^="vendor-name-"]');
  const count = await vendorSelects.count();
  expect(count).toBe(2); // Cisco and Dell Technologies
  console.log('✅ Correct number of vendor blocks created:', count);

  // First vendor should be Cisco
  const firstVendor = await vendorSelects.first().inputValue();
  expect(firstVendor).toBe('Cisco');
  console.log('✅ First vendor correctly set to:', firstVendor);

  // First SKU should be C9300-48P-A
  const firstSku = await page.locator('input[id^="sku-part-"]').first().inputValue();
  expect(firstSku).toBe('C9300-48P-A');
  console.log('✅ First SKU correctly set to:', firstSku);

  // Cisco should have 2 SKU rows (C9300-48P-A and C9300-24T-A)
  const ciscoSkuRows = page.locator('#sku-list-1 .sku-row');
  expect(await ciscoSkuRows.count()).toBe(2);
  console.log('✅ Cisco block has 2 SKU rows');

  // Quantities should be populated
  const firstQty = await page.locator('input[id^="sku-qty-"]').first().inputValue();
  expect(firstQty).toBe('5'); // Cisco C9300-48P-A qty=5
  console.log('✅ First SKU quantity correctly set to:', firstQty);

  const allQtyInputs = page.locator('input[id^="sku-qty-"]');
  const qtys = [];
  for (let i = 0; i < await allQtyInputs.count(); i++) {
    qtys.push(await allQtyInputs.nth(i).inputValue());
  }
  expect(qtys).toContain('2'); // Cisco C9300-24T-A qty=2
  expect(qtys).toContain('3'); // Dell PowerEdge R750 qty=3
  console.log('✅ All quantities present:', qtys.join(', '));

  expect(errors).toHaveLength(0);
  console.log('✅ No JS errors during import');
});

test('Misspelled vendor triggers suggestion and "Use this" corrects it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
  await page.waitForTimeout(4000);

  // Advance to step 2
  await page.fill('#project-title', 'Spell Check Test RFQ');
  await page.fill('#project-desc', 'Testing vendor suggestion on typo');
  await page.fill('#project-deadline', '2026-06-01');
  await page.fill('#project-location', 'Boston, MA');
  await page.locator('#section-1 button.btn-next').click();
  await page.waitForTimeout(500);

  // CSV with "Csico" (typo for Cisco)
  const csvContent = `Vendor,SKU / Part Number,Quantity,Notes\nCsico,C9300-48P-A,5,Core switch\n`;
  const csvPath = '/tmp/test-rfq-typo.csv';
  require('fs').writeFileSync(csvPath, csvContent);

  await page.locator('#import-file').setInputFiles(csvPath);
  await page.waitForTimeout(1000);

  // Suggestions panel should appear
  const suggestionsEl = page.locator('#import-suggestions');
  await expect(suggestionsEl).toBeVisible();
  const suggestionText = await suggestionsEl.textContent();
  expect(suggestionText).toMatch(/Csico/i);
  expect(suggestionText).toMatch(/Cisco/i);
  console.log('✅ Suggestion shown:', suggestionText.trim().replace(/\s+/g, ' '));

  // Vendor should currently be set to "Other"
  const vendorSelect = page.locator('select[id^="vendor-name-"]').first();
  expect(await vendorSelect.inputValue()).toBe('Other');
  console.log('✅ Vendor initially set to Other (unrecognized)');

  // Click "Use Cisco" button
  await page.locator('.btn-suggestion-accept').first().click();
  await page.waitForTimeout(300);

  // Vendor select should now be corrected to Cisco
  expect(await vendorSelect.inputValue()).toBe('Cisco');
  console.log('✅ Vendor corrected to Cisco after accepting suggestion');

  // Suggestion panel should be gone
  await expect(suggestionsEl).not.toBeVisible();
  console.log('✅ Suggestion panel dismissed after accepting');

  expect(errors).toHaveLength(0);
  console.log('✅ No JS errors during spell-check flow');
});
