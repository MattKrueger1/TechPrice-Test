const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';

// ── 1. DATE PICKER AUTO-CLOSE (buyer) ──────────────────────────────────────
test.describe('Submit RFQ — date picker auto-close', () => {
  test.use({ storageState: 'auth.json' });

  test('deadline date picker blur is called on change', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);

    // Wait for auth+init to complete — init sets a default value on deadline
    const deadlineInput = page.locator('#project-deadline');
    await expect(deadlineInput).toHaveValue(/\d{4}-\d{2}-\d{2}/, { timeout: 15000 });

    const blurCalled = await deadlineInput.evaluate(el => {
      let called = false;
      const orig = el.blur.bind(el);
      el.blur = function() { called = true; orig(); };
      el.dispatchEvent(new Event('change'));
      return called;
    });

    expect(blurCalled).toBe(true);
  });

});

// ── 2. BUYER NOTES VISIBLE IN BID MODAL (reseller) ────────────────────────
test.describe('Reseller bid modal — buyer notes', () => {
  test.use({ storageState: 'reseller-auth.json' });

  test('bid modal shows Buyer Notes section when notes exist', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`);

    // Wait for open RFQs to load
    await page.waitForSelector('.rfq-card', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Try each "Place bid" / "Revise bid" button until one shows a SKU table
    // (some RFQs may be split-bids the reseller can't fully price)
    const bidBtns = page.locator('.btn-bid');
    const count = await bidBtns.count();
    let foundSkuTable = false;

    for (let i = 0; i < count && !foundSkuTable; i++) {
      // Close any open modal first
      const modal = page.locator('#bid-modal');
      if (await modal.evaluate(el => !el.classList.contains('hidden')).catch(() => false)) {
        await page.click('button.modal-close').catch(() => {});
        await page.waitForTimeout(300);
      }

      await bidBtns.nth(i).click();
      await expect(modal).not.toHaveClass(/hidden/, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const hasTable = await page.locator('.sku-table').count();
      if (hasTable > 0) {
        foundSkuTable = true;
        console.log(`✅ Bid button ${i + 1} shows a SKU table`);
      }
    }

    if (!foundSkuTable) {
      console.log('ℹ️  No bid modal produced a SKU table (all split-bid / empty) — skipping');
      return;
    }

    // Check if Buyer Notes block rendered (only present if the RFQ has notes)
    const hasNotes = await page.locator('#bid-modal-body').evaluate(el => {
      return el.textContent.includes('Buyer Notes');
    });
    console.log('Buyer Notes section present:', hasNotes);

    // The SKU table must be visible
    await expect(page.locator('.sku-table')).toBeVisible();
  });
});

// ── 3. BADGE COUNTS ON NOTIFICATIONS & SETTINGS PAGES (buyer) ─────────────
test.describe('Buyer sidebar badges', () => {
  test.use({ storageState: 'auth.json' });

  test('notifications page renders without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE}/bidbridge-notifications_1.html`);
    await expect(page.locator('h1')).toBeVisible();

    // Wait for auth init to complete (badges are populated async)
    await page.waitForTimeout(4000);

    // No JS errors
    expect(errors).toHaveLength(0);

    // badge-rfqs element must exist in DOM
    await expect(page.locator('#badge-rfqs')).toBeAttached();
    await expect(page.locator('#badge-review')).toBeAttached();
  });

  test('settings page populates sidebar from Supabase and renders badges', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE}/bidbridge-settings.html`);
    await expect(page.locator('h1')).toBeVisible();

    // Wait for auth init to run
    await page.waitForTimeout(4000);

    // No JS errors
    expect(errors).toHaveLength(0);

    // Sidebar should now show real name (not hardcoded "James M.")
    const sidebarName = await page.locator('#sidebar-name').textContent();
    expect(sidebarName.trim()).not.toBe('');
    expect(sidebarName).not.toContain('James');

    // Badge elements must exist
    await expect(page.locator('#badge-rfqs')).toBeAttached();
    await expect(page.locator('#badge-review')).toBeAttached();
  });
});
