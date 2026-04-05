const { test, expect } = require('@playwright/test');

test.use({ storageState: 'reseller-auth.json' });

const BASE = 'http://localhost:3000';

test('Reseller submits a bid — triggers SMS to buyer', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
  await page.waitForTimeout(4000);

  // Switch to Open RFQs tab
  const openTab = page.locator('button', { hasText: /open rfq/i });
  if (await openTab.count() > 0) await openTab.first().click();
  await page.waitForTimeout(1500);

  // Find first RFQ card that hasn't been bid on yet
  const bidBtn = page.locator('.btn-bid').first();
  if (await bidBtn.count() === 0) {
    console.log('No open RFQs available to bid on — skipping');
    return;
  }

  const rfqTitle = await page.locator('.rfq-card').first().locator('.rfq-title, h3, strong').first().textContent().catch(() => 'Unknown RFQ');
  console.log(`Submitting test bid on: ${rfqTitle?.trim()}`);

  await bidBtn.click();
  await page.waitForTimeout(800);

  // Wait for bid modal to load line items
  await page.waitForSelector('#bid-modal', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(2000);

  // Fill in unit price for each SKU row (price-0, price-1, etc.)
  const priceInputs = page.locator('.sku-price-input');
  const count = await priceInputs.count();
  for (let i = 0; i < count; i++) {
    await priceInputs.nth(i).fill('100');
  }
  await page.waitForTimeout(500);

  // Notes
  const notesInput = page.locator('#bid-notes');
  if (await notesInput.count() > 0) {
    await notesInput.fill('SMS trigger test bid — please ignore');
  }

  // Submit
  await page.locator('.btn-submit-bid').click();
  await page.waitForTimeout(4000);

  // Check for success state
  const success = page.locator('.bid-success');
  if (await success.count() > 0) {
    console.log('✅ Bid submitted successfully — SMS should be on its way to the buyer');
  } else {
    console.log('⚠️  Bid may have already been submitted on this RFQ — check the modal state');
  }

  console.log('✅ Test complete — check your phone for the SMS');
});
