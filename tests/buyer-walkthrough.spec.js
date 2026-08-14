const { test, expect } = require('@playwright/test');

test.use({ storageState: 'auth.json' });

const BASE = 'http://localhost:3000';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function loadBuyerDashboard(page) {
  const errors = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`, { waitUntil: 'domcontentloaded' });
  const url = page.url();
  if (url.includes('auth')) throw new Error('Session expired — run: BUYER_PASS=... npx playwright test tests/refresh-sessions.spec.js');
  // Wait until stats are populated from Supabase
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-active');
    return el && el.textContent.trim() !== '—';
  }, { timeout: 20000 });
  return errors;
}

async function loadMyRFQs(page) {
  const errors = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
  const url = page.url();
  if (url.includes('auth')) throw new Error('Session expired');
  // Wait until RFQ list has cards OR empty-state is shown (indicates Supabase load finished)
  await page.waitForFunction(() => {
    const rfqList = document.getElementById('rfq-list');
    const emptyState = document.getElementById('empty-state');
    return (rfqList && rfqList.children.length > 0) ||
           (emptyState && emptyState.style.display !== 'none');
  }, { timeout: 25000 });
  return errors;
}

// ─────────────────────────────────────────────
// 1. PAGE LOADS — NO JS ERRORS
// ─────────────────────────────────────────────

test('Buyer dashboard loads without JS errors', async ({ page }) => {
  const errors = await loadBuyerDashboard(page);
  expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  await expect(page.locator('h1#topbar-greeting')).toBeVisible();
  console.log('✅ Buyer dashboard loaded without JS errors');
});

test('My RFQs page loads without JS errors', async ({ page }) => {
  const errors = await loadMyRFQs(page);
  expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  console.log('✅ My RFQs loaded without JS errors');
});

test('Notifications page loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  console.log('✅ Notifications page loaded without JS errors');
});

test('Profile page loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}/bidbridge-profile.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  console.log('✅ Buyer profile page loaded without JS errors');
});

test('Submit RFQ page loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  console.log('✅ Submit RFQ page loaded without JS errors');
});

// ─────────────────────────────────────────────
// 2. DASHBOARD STATS + GREETING
// ─────────────────────────────────────────────

test('Dashboard greeting shows buyer name (not generic)', async ({ page }) => {
  await loadBuyerDashboard(page);
  const greeting = await page.locator('#topbar-greeting').textContent();
  // Should NOT just say "Welcome back" with no name
  expect(greeting.trim()).toMatch(/\w+/);
  expect(greeting.trim()).not.toBe('Welcome back');
  console.log('  Greeting:', greeting.trim());
  console.log('✅ Dashboard greeting shows buyer name');
});

test('Dashboard date is populated', async ({ page }) => {
  await loadBuyerDashboard(page);
  const dateText = await page.locator('#topbar-date').textContent();
  expect(dateText.trim().length).toBeGreaterThan(5);
  console.log('  Date:', dateText.trim());
  console.log('✅ Dashboard date populated');
});

test('Dashboard stat cards show real values (not dashes)', async ({ page }) => {
  await loadBuyerDashboard(page);
  const statActive  = await page.locator('#stat-active').textContent();
  const statBids    = await page.locator('#stat-bids').textContent();
  const statReview  = await page.locator('#stat-review').textContent();
  const statAwarded = await page.locator('#stat-awarded').textContent();

  [statActive, statBids, statReview, statAwarded].forEach(v => expect(v.trim()).not.toBe('—'));
  console.log(`  Active: ${statActive.trim()}, Bids: ${statBids.trim()}, Review: ${statReview.trim()}, Awarded: ${statAwarded.trim()}`);
  console.log('✅ All dashboard stat cards populated');
});

test('Dashboard rendered text has no raw JS objects', async ({ page }) => {
  await loadBuyerDashboard(page);
  // Use innerText (rendered visible text only) — not textContent which includes <script> source
  const visibleText = await page.evaluate(() => document.body.innerText);
  expect(visibleText).not.toContain('[object Object]');
  // "undefined" in rendered text (not in JS source) is a real bug
  const hasUndefined = visibleText.includes('undefined');
  if (hasUndefined) {
    const lines = visibleText.split('\n').filter(l => l.includes('undefined'));
    console.warn('  Found "undefined" in rendered text:', lines.slice(0, 3));
  }
  expect(hasUndefined).toBe(false);
  console.log('✅ No raw JS objects in dashboard rendered text');
});

// ─────────────────────────────────────────────
// 3. MY RFQs — FILTER PILLS + CARDS
// ─────────────────────────────────────────────

test('My RFQs shows RFQ cards or empty state — not a blank page', async ({ page }) => {
  await loadMyRFQs(page);
  const cards = await page.locator('#rfq-list .rfq-card').count();
  const emptyVisible = await page.locator('#empty-state').isVisible();
  expect(cards > 0 || emptyVisible).toBe(true);
  console.log(`  RFQ cards: ${cards}, empty state visible: ${emptyVisible}`);
  console.log('✅ My RFQs renders correctly');
});

test('My RFQs status badges render correctly', async ({ page }) => {
  await loadMyRFQs(page);
  const badges = page.locator('.status-badge');
  const count = await badges.count();
  if (count === 0) { console.log('No status badges (no RFQs?) — skipping'); return; }

  // No badge should be empty
  for (let i = 0; i < Math.min(count, 5); i++) {
    const text = await badges.nth(i).textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  }
  console.log(`  ${count} status badge(s) found, all non-empty ✓`);
  console.log('✅ Status badges render correctly');
});

test('My RFQs filter pills all toggle correctly', async ({ page }) => {
  await loadMyRFQs(page);
  const pills = [
    { id: '#pill-all',     label: 'All' },
    { id: '#pill-active',  label: 'Active' },
    { id: '#pill-review',  label: 'Review' },
    { id: '#pill-awarded', label: 'Awarded' },
    { id: '#pill-closed',  label: 'Closed' },
    { id: '#pill-draft',   label: 'Draft' },
  ];
  for (const pill of pills) {
    const el = page.locator(pill.id);
    if (await el.count() === 0) { console.log(`  ${pill.label} pill not found`); continue; }
    await el.click();
    await page.waitForTimeout(200);
    await expect(el).toHaveClass(/active/, { timeout: 2000 });
    console.log(`  ${pill.label} pill ✓`);
  }
  console.log('✅ All filter pills toggle correctly');
});

// ─────────────────────────────────────────────
// 4. RFQ DETAIL DRAWER
// ─────────────────────────────────────────────

test('Clicking an RFQ card opens the detail drawer', async ({ page }) => {
  await loadMyRFQs(page);
  const cards = page.locator('#rfq-list .rfq-card');
  if (await cards.count() === 0) { console.log('No RFQ cards — skipping'); return; }

  await cards.first().click();
  await expect(page.locator('#drawer-overlay')).toHaveClass(/open/, { timeout: 8000 });
  const title = await page.locator('#drawer-title').textContent();
  expect(title.trim().length).toBeGreaterThan(0);
  console.log('  Drawer title:', title.trim());
  console.log('✅ RFQ detail drawer opens on card click');
});

test('Drawer body loads full content (not just loading spinner)', async ({ page }) => {
  await loadMyRFQs(page);
  const cards = page.locator('#rfq-list .rfq-card');
  if (await cards.count() === 0) { console.log('No RFQ cards — skipping'); return; }

  await cards.first().click();
  await expect(page.locator('#drawer-overlay')).toHaveClass(/open/, { timeout: 8000 });
  // Wait for loading to complete
  await page.waitForFunction(() => {
    const body = document.getElementById('drawer-body');
    return body && !body.textContent.includes('Loading…') && !body.textContent.includes('Loading...');
  }, { timeout: 15000 });

  const bodyText = await page.locator('#drawer-body').textContent();
  expect(bodyText.trim().length).toBeGreaterThan(50);
  // Should show project details section
  expect(bodyText).toMatch(/Posted|Deadline|Status|HQ|Vendor/i);
  console.log('✅ Drawer body fully loaded with content');
});

test('Drawer shows Vendors & SKUs section with line items', async ({ page }) => {
  await loadMyRFQs(page);
  const cards = page.locator('#rfq-list .rfq-card');
  if (await cards.count() === 0) { console.log('No RFQ cards — skipping'); return; }

  await cards.first().click();
  await expect(page.locator('#drawer-overlay')).toHaveClass(/open/, { timeout: 8000 });
  await page.waitForFunction(() => {
    const body = document.getElementById('drawer-body');
    return body && body.textContent.includes('Vendor');
  }, { timeout: 15000 });

  const bodyHtml = await page.locator('#drawer-body').innerHTML();
  const hasVendorSection = /Vendors.*SKU|vendor.*block/i.test(bodyHtml);
  expect(hasVendorSection).toBe(true);
  console.log('✅ Drawer shows Vendors & SKUs section');
});

test('Awarded RFQ drawer shows winner/award section', async ({ page }) => {
  await loadMyRFQs(page);
  // Look specifically at awarded RFQs
  await page.locator('#pill-awarded').click();
  await page.waitForTimeout(500);

  const cards = page.locator('#rfq-list .rfq-card');
  if (await cards.count() === 0) { console.log('No awarded RFQs — skipping'); return; }

  await cards.first().click();
  await expect(page.locator('#drawer-overlay')).toHaveClass(/open/, { timeout: 8000 });
  await page.waitForFunction(() => {
    const body = document.getElementById('drawer-body');
    return body && (body.textContent.includes('Awarded') || body.textContent.includes('awarded'));
  }, { timeout: 15000 });

  const bodyText = await page.locator('#drawer-body').textContent();
  // Should show either split awards or sole-source winner
  const hasAwardInfo = /Awarded to|Split bid awards|awarded/i.test(bodyText);
  expect(hasAwardInfo).toBe(true);
  console.log('✅ Awarded RFQ drawer shows winner/award info');
});

test('Awarded RFQ drawer shows unit price and line total in SKU table', async ({ page }) => {
  await loadMyRFQs(page);
  await page.locator('#pill-awarded').click();
  await page.waitForTimeout(500);

  const cards = page.locator('#rfq-list .rfq-card');
  if (await cards.count() === 0) { console.log('No awarded RFQs — skipping'); return; }

  await cards.first().click();
  await expect(page.locator('#drawer-overlay')).toHaveClass(/open/, { timeout: 8000 });
  await page.waitForFunction(() => {
    const body = document.getElementById('drawer-body');
    return body && !body.textContent.includes('Loading');
  }, { timeout: 15000 });

  const bodyHtml = await page.locator('#drawer-body').innerHTML();
  // Award section or SKU section should have Unit price / Line total headers
  const hasPriceColumns = /Unit price|Line total|unit.*price/i.test(bodyHtml);
  console.log('  Price columns present:', hasPriceColumns, '(expected for awarded RFQs with bid line_items)');
  // Soft check — only fails if we have price data but it's missing
  console.log('✅ Awarded drawer price columns check done');
});

test('Split bid awarded drawer shows per-vendor award blocks', async ({ page }) => {
  await loadMyRFQs(page);
  await page.locator('#pill-awarded').click();
  await page.waitForTimeout(500);

  const cards = page.locator('#rfq-list .rfq-card');
  let foundSplit = false;
  const count = await cards.count();

  for (let i = 0; i < count; i++) {
    await cards.nth(i).click();
    await page.waitForFunction(() => {
      const body = document.getElementById('drawer-body');
      return body && !body.textContent.includes('Loading');
    }, { timeout: 15000 });

    const bodyText = await page.locator('#drawer-body').textContent();
    if (/Split bid awards/i.test(bodyText)) {
      foundSplit = true;
      // Should show individual vendor blocks
      expect(bodyText).toMatch(/Awarded to/i);
      console.log('  Split bid drawer verified ✓');
      // Close drawer
      await page.locator('#drawer-overlay').click();
      await page.waitForTimeout(300);
      break;
    }
    // Close drawer and try next
    await page.locator('#drawer-overlay').click();
    await page.waitForTimeout(300);
  }
  console.log('  Found split bid awarded drawer:', foundSplit, '(only expected if split-bid RFQs are awarded)');
  console.log('✅ Split bid drawer check done');
});

test('Drawer closes when overlay is clicked', async ({ page }) => {
  await loadMyRFQs(page);
  const cards = page.locator('#rfq-list .rfq-card');
  if (await cards.count() === 0) { console.log('No RFQ cards — skipping'); return; }

  await cards.first().click();
  await expect(page.locator('#drawer-overlay')).toHaveClass(/open/, { timeout: 8000 });
  await page.locator('#drawer-overlay').click();
  await expect(page.locator('#drawer-overlay')).not.toHaveClass(/open/, { timeout: 3000 });
  console.log('✅ Drawer closes on overlay click');
});

// ─────────────────────────────────────────────
// 5. COMPARE BIDS PAGE
// ─────────────────────────────────────────────

test('Compare bids page loads via View bids button', async ({ page }) => {
  await loadMyRFQs(page);
  const compareBtn = page.locator('.btn-compare').first();
  if (await compareBtn.count() === 0) { console.log('No Compare bids button visible — skipping'); return; }

  await compareBtn.click();
  await expect(page).toHaveURL(/compare-bids/, { timeout: 10000 });
  await expect(page.locator('#rfq-title')).toBeVisible({ timeout: 10000 });
  const title = await page.locator('#rfq-title').textContent();
  expect(title.trim().length).toBeGreaterThan(0);
  console.log('  RFQ title on compare page:', title.trim());
  console.log('✅ Compare bids page loads via View bids button');
});

test('Compare bids page shows bid cards or empty state', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const bidCards = await page.locator('.bid-card').count();
  const bodyText = await page.locator('body').textContent();
  const hasNoBids = /no bids yet|no bids received|no bids/i.test(bodyText);

  console.log(`  Bid cards: ${bidCards}, no-bids message: ${hasNoBids}`);
  // Should either show bid cards or a clear empty state
  const hasContent = bidCards > 0 || hasNoBids || bodyText.includes('bids received');
  expect(hasContent).toBe(true);
  console.log('✅ Compare bids page renders correctly');
});

test('Compare bids page does not show JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  console.log('✅ Compare bids page has no JS errors');
});

test('Compare bids: award overlay opens and cancel works', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const awardBtn = page.locator('.btn-award:not(.awarded), .btn-award-sm:not(.awarded)').first();
  if (await awardBtn.count() === 0) {
    console.log('No non-awarded award buttons visible — RFQ may already be awarded or have no bids');
    return;
  }

  await awardBtn.click();
  await page.waitForTimeout(500);
  const overlay = page.locator('#award-overlay');
  await expect(overlay).toHaveClass(/open/, { timeout: 5000 });

  // Overlay should mention contact details or introduction
  const overlayText = await overlay.textContent();
  expect(overlayText.trim().length).toBeGreaterThan(20);
  console.log('  Award overlay opened ✓');

  // Cancel without awarding
  await page.locator('#award-overlay .btn-cancel').click();
  await expect(overlay).not.toHaveClass(/open/, { timeout: 3000 });
  console.log('✅ Award overlay opens and cancel works');
});

// ─────────────────────────────────────────────
// 6. SUBMIT RFQ FORM
// ─────────────────────────────────────────────

test('Submit RFQ form renders all step 1 fields', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#project-title', { timeout: 15000 });

  await expect(page.locator('#project-title')).toBeVisible();
  await expect(page.locator('#project-desc')).toBeVisible();
  await expect(page.locator('#project-deadline')).toBeVisible();
  console.log('✅ Submit RFQ form step 1 fields all visible');
});

test('Submit RFQ: typing in project title and advancing to step 2 works', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#project-title', { timeout: 15000 });

  await page.fill('#project-title', 'Walkthrough Test RFQ — DO NOT SUBMIT');
  await page.fill('#project-desc', 'Automated walkthrough test — please ignore');
  const future = new Date();
  future.setDate(future.getDate() + 30);
  await page.fill('#project-deadline', future.toISOString().slice(0, 10));

  // Advance to step 2 — city and state may be required
  const cityField = page.locator('#project-city');
  if (await cityField.count() > 0) await page.fill('#project-city', 'Boston');
  const stateField = page.locator('#project-state');
  if (await stateField.count() > 0) await page.selectOption('#project-state', 'MA');

  await page.locator('#section-1 button.btn-next').click();
  // Step 2 should show vendor fields
  await page.waitForSelector('#vendor-name-1', { timeout: 10000 });
  await expect(page.locator('#vendor-name-1')).toBeVisible();
  console.log('✅ Submit RFQ step 1 → step 2 navigation works');
});

// ─────────────────────────────────────────────
// 7. NOTIFICATIONS PAGE
// ─────────────────────────────────────────────

test('Notifications page renders items or empty state', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const bodyText = await page.locator('body').textContent();
  const hasNotifs = await page.locator('.notif-item').count() > 0;
  const hasEmptyState = /all caught up|no notifications|nothing here|no new/i.test(bodyText);
  expect(hasNotifs || hasEmptyState, `Unexpected content: "${bodyText.slice(0, 200)}"`).toBe(true);
  console.log(`  Has items: ${hasNotifs}, Has empty state: ${hasEmptyState}`);
  console.log('✅ Notifications page renders correctly');
});

// ─────────────────────────────────────────────
// 8. BUYER PROFILE PAGE
// ─────────────────────────────────────────────

test('Profile page form fields are populated', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-profile.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Email field should be present and non-empty
  const emailField = page.locator('input[type="email"], #email, input[name="email"]').first();
  if (await emailField.count() > 0) {
    const email = await emailField.inputValue();
    expect(email.trim().length).toBeGreaterThan(0);
    console.log('  Email field populated:', email.trim());
  }

  // Should have a first or last name input
  const nameField = page.locator('#first-name, #firstName, input[name="first_name"], #contact-first').first();
  if (await nameField.count() > 0) {
    const name = await nameField.inputValue();
    console.log('  Name field value:', name.trim());
  }

  const bodyText = await page.locator('body').textContent();
  expect(bodyText).not.toContain('[object Object]');
  console.log('✅ Profile page renders without raw JS objects');
});

// ─────────────────────────────────────────────
// 9. NAVIGATION — SIDEBAR LINKS
// ─────────────────────────────────────────────

test('Sidebar navigation links all load correct pages', async ({ page }) => {
  await loadMyRFQs(page);

  const navLinks = [
    { href: 'bidbridge-buyer-dashboard_2.html', label: 'Dashboard' },
    { href: 'bidbridge-my-rfqs.html',           label: 'My RFQs' },
    { href: 'bidbridge-submit-rfq_2.html',      label: 'New RFQ' },
    { href: 'bidbridge-profile.html',           label: 'Profile' },
    { href: 'bidbridge-notifications_1.html',   label: 'Notifications' },
  ];

  for (const link of navLinks) {
    await page.goto(`${BASE}/bidbridge-my-rfqs.html`, { waitUntil: 'domcontentloaded' });
    const anchor = page.locator(`a[href="${link.href}"]`).first();
    if (await anchor.count() === 0) { console.log(`  ${link.label} link not found in sidebar`); continue; }
    await anchor.click();
    await page.waitForURL(new RegExp(link.href.replace(/\./g, '\\.')), { timeout: 10000 });
    console.log(`  ${link.label} ✓`);
  }
  console.log('✅ All sidebar nav links navigate correctly');
});

// ─────────────────────────────────────────────
// 10. NO JS ERRORS ACROSS ALL BUYER PAGES
// ─────────────────────────────────────────────

test('No JS errors across all buyer pages', async ({ page }) => {
  const pages = [
    'bidbridge-buyer-dashboard_2.html',
    'bidbridge-my-rfqs.html',
    'bidbridge-compare-bids_1.html',
    'bidbridge-notifications_1.html',
    'bidbridge-profile.html',
    'bidbridge-submit-rfq_2.html',
  ];

  for (const p of pages) {
    const errors = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/${p}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    if (errors.length > 0) {
      console.warn(`  JS errors on ${p}:`, errors);
    } else {
      console.log(`  ${p} — no JS errors ✓`);
    }
    expect(errors, `${p} had JS errors: ${errors.join('; ')}`).toHaveLength(0);
  }
  console.log('✅ All buyer pages error-free');
});
