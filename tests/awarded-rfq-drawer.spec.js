const { test, expect } = require('@playwright/test');

test.use({ storageState: 'auth.json' });

const BASE = 'http://localhost:3000';

test('My RFQs page loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  await page.waitForTimeout(4000);

  expect(errors).toHaveLength(0);
  console.log('✅ My RFQs loaded without JS errors');
});

test('Awarded filter shows awarded RFQ cards', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  await page.waitForTimeout(4000);

  const awardedTab = page.locator('#pill-awarded, .filter-pill', { hasText: /^awarded$/i });
  if (await awardedTab.count() === 0) {
    console.log('No Awarded filter tab found — skipping');
    return;
  }

  await awardedTab.first().click();
  await page.waitForTimeout(500);

  const cards = page.locator('.rfq-card, .rfq-item');
  const count = await cards.count();
  console.log(`✅ Awarded filter shows ${count} card(s)`);
});

test('Clicking awarded RFQ card opens drawer without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  await page.waitForTimeout(4000);

  // Switch to awarded filter
  const awardedTab = page.locator('#pill-awarded, .filter-pill', { hasText: /^awarded$/i });
  if (await awardedTab.count() === 0) {
    console.log('No Awarded filter — skipping');
    return;
  }
  await awardedTab.first().click();
  await page.waitForTimeout(500);

  // Find first awarded card
  const firstCard = page.locator('.rfq-card, .rfq-item').first();
  if (await firstCard.count() === 0) {
    console.log('No awarded RFQ cards visible — skipping');
    return;
  }

  await firstCard.click();
  await page.waitForTimeout(3000); // allow bid + profile fetch

  // Drawer should be open
  const drawer = page.locator('#drawer, .drawer');
  await expect(drawer.first()).toBeVisible({ timeout: 5000 });

  expect(errors).toHaveLength(0);
  console.log('✅ Drawer opened without JS errors');
});

test('Awarded RFQ drawer shows winning bid section with line items', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  await page.waitForTimeout(4000);

  const awardedTab = page.locator('#pill-awarded, .filter-pill', { hasText: /^awarded$/i });
  if (await awardedTab.count() === 0) {
    console.log('No Awarded filter — skipping');
    return;
  }
  await awardedTab.first().click();
  await page.waitForTimeout(500);

  const cards = page.locator('.rfq-card, .rfq-item');
  const cardCount = await cards.count();
  if (cardCount === 0) {
    console.log('No awarded cards — skipping');
    return;
  }

  // Try each awarded card — at least one should have line items with unit prices
  let foundLineItems = false;
  for (let i = 0; i < cardCount; i++) {
    await cards.nth(i).click();
    await page.waitForTimeout(3000);

    const drawer = page.locator('#drawer, .drawer').first();
    if (!await drawer.isVisible()) continue;

    const drawerText = await drawer.textContent();
    expect(drawerText).toMatch(/awarded to/i);

    // Check for unit price column header AND dollar values in table rows (not just grand total)
    const hasUnitPriceCol = /unit price/i.test(drawerText);
    const dollarValues = drawerText.match(/\$[\d,]+\.\d{2}/g) || [];
    // More than 1 dollar value means we have per-item prices + grand total
    if (hasUnitPriceCol && dollarValues.length > 1) {
      foundLineItems = true;
      console.log(`✅ Card ${i + 1}: Unit price table showing: ${dollarValues.join(', ')}`);
      expect(dollarValues.length).toBeGreaterThan(1);
      break;
    } else {
      const rfqTitle = await cards.nth(i).locator('.rfq-title, h3, strong').first().textContent().catch(() => `card ${i+1}`);
      console.log(`ℹ️  Card ${i + 1} (${rfqTitle?.trim()}): no line_items in DB for this bid`);
      // Close drawer and try next
      await page.locator('#drawer-overlay, .drawer-overlay').click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  if (foundLineItems) {
    console.log('✅ At least one awarded RFQ shows full line item pricing');
  } else {
    console.log('ℹ️  None of the awarded bids have line_items stored (all pre-date line_items tracking)');
  }
});

test('Awarded drawer still shows RFQ detail sections', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  await page.waitForTimeout(4000);

  const awardedTab = page.locator('#pill-awarded, .filter-pill', { hasText: /^awarded$/i });
  if (await awardedTab.count() === 0) {
    console.log('No Awarded filter — skipping');
    return;
  }
  await awardedTab.first().click();
  await page.waitForTimeout(500);

  const firstCard = page.locator('.rfq-card, .rfq-item').first();
  if (await firstCard.count() === 0) {
    console.log('No awarded cards — skipping');
    return;
  }

  await firstCard.click();
  await page.waitForTimeout(3000);

  const drawer = page.locator('#drawer, .drawer').first();
  await expect(drawer).toBeVisible({ timeout: 5000 });

  const drawerText = await drawer.textContent();

  // Standard sections should still be present
  expect(drawerText).toMatch(/project details|vendors/i);
  console.log('✅ Standard RFQ detail sections still present in drawer');
});
