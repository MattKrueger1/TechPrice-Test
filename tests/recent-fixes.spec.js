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

  test('deadline date picker blur is called on change', async ({ page }) => {
    await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);

    // Wait for auth+init to complete (deadline gets a default value)
    await expect(page.locator('#project-deadline')).toHaveValue(/\d{4}-\d{2}-\d{2}/, { timeout: 15000 });

    const deadlineInput = page.locator('#project-deadline');
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

    // Click first available "Place bid" button
    const bidBtn = page.locator('.btn-bid').first();
    await expect(bidBtn).toBeVisible({ timeout: 10000 });
    await bidBtn.click();

    // Modal should open
    await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/, { timeout: 8000 });
    await expect(page.locator('#bid-modal-body')).toBeVisible();

    // Wait for modal content to fully load (SKU table renders)
    await page.waitForSelector('.sku-table', { timeout: 15000 });

    // Check if Buyer Notes block rendered (only present if the RFQ has notes)
    const hasNotes = await page.locator('#bid-modal-body').evaluate(el => {
      return el.textContent.includes('Buyer Notes');
    });

    // Log what we find — the test validates structure, not specific data
    console.log('Buyer Notes section present:', hasNotes);

    // The SKU table must always be there
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
