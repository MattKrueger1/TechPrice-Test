/**
 * Tests for reseller dashboard changes:
 * 1. Min tier badge removed from open RFQ cards
 * 2. My Bids defaults to "Active" filter
 * 3. Rank disclosure hides total bid count
 * 4. Authorization checkbox required before submission
 * 5. No budget in bid submission modal
 */
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'reseller-auth.json' });

const BASE = 'http://localhost:3000';

test.describe('Reseller dashboard — UI changes', () => {

  test('Min tier badge is absent from open RFQ cards', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
    await page.waitForTimeout(3000);

    const cardCount = await page.locator('#open-rfq-grid .rfq-card').count();
    if (cardCount === 0) {
      console.log('ℹ️ No open RFQ cards — skipping tier badge check');
      return;
    }

    // No star/min tier meta items should exist in open RFQ cards
    const tierMeta = page.locator('#open-rfq-grid .rfq-meta-item');
    await expect(tierMeta).toHaveCount(0);
    console.log('✅ No min tier meta items in open RFQ cards');

    // No tier-req tag either
    const tierReqTag = page.locator('#open-rfq-grid .rfq-tag.tier-req');
    await expect(tierReqTag).toHaveCount(0);
    console.log('✅ No tier-req tag in open RFQ cards');
  });

  test('My Bids filter defaults to Active, not All bids', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await page.waitForSelector('#section-my-bids', { timeout: 20000 });

    // "Active" pill should have the active class
    const activePill = page.locator('#mybids-pill-active');
    await expect(activePill).toHaveClass(/active/);
    console.log('✅ Active pill is selected by default');

    // "All bids" pill should NOT have the active class
    const allPill = page.locator('#mybids-pill-all');
    await expect(allPill).not.toHaveClass(/active/);
    console.log('✅ All bids pill is NOT selected by default');
  });

  test('Rank label does not reveal total bid count', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
    await page.waitForTimeout(3000); // wait for data to load

    // Check rank pills in open RFQ cards — should not say "X bids"
    const rankPills = page.locator('#open-rfq-grid .bid-rank-pill');
    const count = await rankPills.count();
    for (let i = 0; i < count; i++) {
      const text = await rankPills.nth(i).textContent();
      expect(text).not.toMatch(/\d+ bid/i);
    }
    console.log(`✅ ${count} rank pill(s) — none reveal total bid count`);

    // Also check My Bids section rank pills
    await page.locator('#mybids-pill-all').click();
    await page.waitForTimeout(500);
    const myBidRankPills = page.locator('#my-bids-list .bid-rank-pill');
    const myBidCount = await myBidRankPills.count();
    for (let i = 0; i < myBidCount; i++) {
      const text = await myBidRankPills.nth(i).textContent();
      expect(text).not.toMatch(/\d+ total bid/i);
    }
    console.log(`✅ ${myBidCount} my-bids rank pill(s) — none show total bid count`);
  });

  test('Bid modal requires authorization checkbox before submit', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
    await page.waitForTimeout(3000);

    const firstCard = page.locator('#open-rfq-grid .rfq-card').first();
    if (await firstCard.count() === 0) {
      console.log('ℹ️ No open RFQ cards — skipping bid modal checkbox test');
      return;
    }

    // Open bid form on first RFQ
    await firstCard.click();
    await page.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#bid-modal-body .sku-table', { timeout: 15000 });

    // Submit button should be disabled by default
    const submitBtn = page.locator('#bid-submit-btn');
    await expect(submitBtn).toBeDisabled();
    console.log('✅ Submit button disabled before checkbox checked');

    // Check the authorization checkbox
    const checkbox = page.locator('#bid-auth-checkbox');
    await expect(checkbox).toBeVisible();
    await checkbox.check();

    // Submit button should now be enabled
    await expect(submitBtn).toBeEnabled();
    console.log('✅ Submit button enabled after checkbox checked');

    // Uncheck — should disable again
    await checkbox.uncheck();
    await expect(submitBtn).toBeDisabled();
    console.log('✅ Submit button disabled again after unchecking');

    await page.locator('#bid-modal button.btn-cancel-bid').click();
  });

  test('Authorization checkbox resets when modal reopens', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
    await page.waitForTimeout(3000);

    const firstCard = page.locator('#open-rfq-grid .rfq-card').first();
    if (await firstCard.count() === 0) {
      console.log('ℹ️ No open RFQ cards — skipping checkbox reset test');
      return;
    }

    // Open, check box, close
    await firstCard.click();
    await page.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#bid-modal-body .sku-table', { timeout: 15000 });
    await page.locator('#bid-auth-checkbox').check();
    await expect(page.locator('#bid-submit-btn')).toBeEnabled();
    await page.locator('#bid-modal button.btn-cancel-bid').click();
    await page.waitForTimeout(300);

    // Reopen — checkbox should be unchecked and submit should be disabled
    await firstCard.click();
    await page.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#bid-modal-body .sku-table', { timeout: 15000 });
    const checkbox = page.locator('#bid-auth-checkbox');
    await expect(checkbox).not.toBeChecked();
    await expect(page.locator('#bid-submit-btn')).toBeDisabled();
    console.log('✅ Checkbox resets to unchecked on modal reopen');

    await page.locator('#bid-modal button.btn-cancel-bid').click();
  });

  test('No budget info in bid submission modal', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);
    await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
    await page.waitForTimeout(3000);

    const firstCard = page.locator('#open-rfq-grid .rfq-card').first();
    if (await firstCard.count() === 0) {
      console.log('ℹ️ No open RFQ cards — skipping budget modal test');
      return;
    }

    await page.locator('#open-rfq-grid .rfq-card').first().click();
    await page.waitForSelector('#bid-modal', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#bid-modal-body .sku-table', { timeout: 15000 });

    const modalText = await page.locator('#bid-modal').textContent();
    expect(modalText).not.toMatch(/budget/i);
    expect(modalText).not.toMatch(/not disclosed/i);
    console.log('✅ No budget info in bid submission modal');

    await page.locator('#bid-modal button.btn-cancel-bid').click();
  });

});
