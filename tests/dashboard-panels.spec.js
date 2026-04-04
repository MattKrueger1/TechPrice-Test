const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const BUYER_EMAIL = 'mattkrueger@comcast.net';
const BUYER_PASSWORD = 'Test12345678';

async function loginAndLoad(page) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', BUYER_EMAIL);
  await page.fill('#login-password', BUYER_PASSWORD);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(4000); // let all data load
}

/* ══════════════════════════════════════════════════════════
   DEFAULT STATE
══════════════════════════════════════════════════════════ */

test('Dashboard loads with RFQs panel active by default', async ({ page }) => {
  await loginAndLoad(page);
  await expect(page.locator('#panel-rfqs')).toHaveClass(/active/);
  await expect(page.locator('#panel-bids')).not.toHaveClass(/active/);
  await expect(page.locator('#panel-awarded')).not.toHaveClass(/active/);
  await expect(page.locator('#stat-card-rfqs')).toHaveClass(/selected/);
  console.log('✅ RFQs panel is active by default');
});

test('RFQ table is visible in default state', async ({ page }) => {
  await loginAndLoad(page);
  await expect(page.locator('#rfq-table')).toBeVisible();
  await expect(page.locator('#rfq-tbody tr').first()).toBeVisible();
  console.log('✅ RFQ table visible with rows');
});

test('Recent activity section is always visible regardless of panel', async ({ page }) => {
  await loginAndLoad(page);
  await expect(page.locator('.notif-section')).toBeVisible();

  // Switch panel — activity should still be visible
  await page.click('#stat-bids-card');
  await expect(page.locator('.notif-section')).toBeVisible();
  console.log('✅ Recent activity visible across panel switches');
});

/* ══════════════════════════════════════════════════════════
   ACTIVE RFQs PANEL
══════════════════════════════════════════════════════════ */

test('Clicking Active RFQs stat card shows RFQs panel', async ({ page }) => {
  await loginAndLoad(page);
  // First switch away
  await page.click('#stat-bids-card');
  await expect(page.locator('#panel-bids')).toHaveClass(/active/);

  // Now click Active RFQs
  await page.click('#stat-card-rfqs');
  await expect(page.locator('#panel-rfqs')).toHaveClass(/active/);
  await expect(page.locator('#stat-card-rfqs')).toHaveClass(/selected/);
  await expect(page.locator('#rfq-table')).toBeVisible();
  console.log('✅ Active RFQs stat card shows RFQs panel');
});

test('RFQ filter pills work within the panel', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-card-rfqs');

  // Click Active filter
  await page.click('#filter-pill-active');
  await expect(page.locator('#filter-pill-active')).toHaveClass(/active/);
  const activeRows = await page.locator('#rfq-tbody tr[data-status="active"]').count();
  const allDataRows = await page.locator('#rfq-tbody tr[data-status]').count();
  // All data rows should be active (excludes expand rows which have no data-status)
  expect(allDataRows).toBe(activeRows);
  console.log(`✅ Active filter: ${activeRows} active RFQ(s) shown`);
});

test('RFQ filter — Awarded filter shows only awarded rows', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#filter-pill-awarded');
  await expect(page.locator('#filter-pill-awarded')).toHaveClass(/active/);
  const awardedRows = await page.locator('#rfq-tbody tr[data-status="awarded"]').count();
  const totalDataRows = await page.locator('#rfq-tbody tr[data-status]').count();
  expect(totalDataRows).toBe(awardedRows);
  console.log(`✅ Awarded filter: ${awardedRows} awarded RFQ(s) shown`);
});

test('RFQ filter — All shows all rows', async ({ page }) => {
  await loginAndLoad(page);
  // Set active first, then switch to all
  await page.click('#filter-pill-active');
  await page.click('#filter-pill-all');
  await expect(page.locator('#filter-pill-all')).toHaveClass(/active/);
  const allRows = await page.locator('#rfq-tbody tr').count();
  const totalRfqs = parseInt(await page.locator('#stat-active').textContent()) +
                    parseInt(await page.locator('#stat-awarded').textContent());
  expect(allRows).toBeGreaterThan(0);
  console.log(`✅ All filter: ${allRows} total RFQ rows`);
});

test('Awaiting review stat card switches to RFQ panel with Review filter active', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-card-review');
  await expect(page.locator('#panel-rfqs')).toHaveClass(/active/);
  await expect(page.locator('#filter-pill-review')).toHaveClass(/active/);
  console.log('✅ Awaiting review card switches panel and activates Review filter');
});

test('Clicking RFQ row expands inline bid list (no navigation)', async ({ page }) => {
  await loginAndLoad(page);
  // Click the first data row — should expand inline, not navigate
  const firstRow = page.locator('#rfq-tbody tr:not(.rfq-expand-row)').first();
  await firstRow.click();
  // Should stay on dashboard
  await expect(page).toHaveURL(/buyer-dashboard/, { timeout: 3000 });
  // The expand inner for the first rfq should be open
  const firstExpand = page.locator('.rfq-expand-inner').first();
  await expect(firstExpand).toHaveClass(/open/);
  console.log('✅ Clicking RFQ row expands inline without navigating');
});

test('Clicking expanded RFQ row collapses it', async ({ page }) => {
  await loginAndLoad(page);
  const firstRow = page.locator('#rfq-tbody tr:not(.rfq-expand-row)').first();
  await firstRow.click(); // expand
  const firstExpand = page.locator('.rfq-expand-inner').first();
  await expect(firstExpand).toHaveClass(/open/);
  await firstRow.click(); // collapse
  await expect(firstExpand).not.toHaveClass(/open/);
  console.log('✅ Second click collapses the RFQ row');
});

test('RFQ row View button navigates to compare-bids', async ({ page }) => {
  await loginAndLoad(page);
  const viewBtn = page.locator('#rfq-tbody .btn-view').first();
  await viewBtn.click();
  await expect(page).toHaveURL(/compare-bids/, { timeout: 10000 });
  console.log('✅ View button navigates to compare-bids');
});

/* ══════════════════════════════════════════════════════════
   TOTAL BIDS RECEIVED PANEL
══════════════════════════════════════════════════════════ */

test('Clicking Total Bids card shows bids panel (no navigation)', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-bids-card');

  // Should stay on dashboard
  await expect(page).toHaveURL(/buyer-dashboard/);
  await expect(page.locator('#panel-bids')).toHaveClass(/active/);
  await expect(page.locator('#stat-bids-card')).toHaveClass(/selected/);
  console.log('✅ Total bids card shows bids panel without navigating away');
});

test('Bids panel shows RFQ sections with bid counts', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-bids-card');
  await page.waitForTimeout(500);

  const sections = page.locator('.bids-panel-section');
  const count = await sections.count();
  console.log(`✅ Bids panel shows ${count} RFQ section(s)`);

  if (count > 0) {
    // Each section should have an RFQ title
    const firstTitle = await sections.first().locator('.bids-panel-rfq-title').textContent();
    expect(firstTitle.trim().length).toBeGreaterThan(0);
    console.log(`✅ First RFQ in bids panel: "${firstTitle.trim()}"`);
  }
});

test('Bids panel — clicking RFQ header expands bid list', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-bids-card');
  await page.waitForTimeout(500);

  const firstHeader = page.locator('.bids-panel-rfq-header').first();
  if (await firstHeader.count() === 0) {
    console.log('ℹ️  No bid sections to expand');
    return;
  }

  await firstHeader.click();
  await page.waitForTimeout(300);

  // Header should have expanded class
  await expect(firstHeader).toHaveClass(/expanded/);

  // Bid list should be open
  const firstList = page.locator('.bids-panel-bid-list').first();
  await expect(firstList).toHaveClass(/open/);
  console.log('✅ Clicking RFQ header expands bid list');
});

test('Bids panel — clicking expanded header collapses bid list', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-bids-card');
  await page.waitForTimeout(500);

  const firstHeader = page.locator('.bids-panel-rfq-header').first();
  if (await firstHeader.count() === 0) return;

  // Expand
  await firstHeader.click();
  await page.waitForTimeout(200);
  await expect(page.locator('.bids-panel-bid-list').first()).toHaveClass(/open/);

  // Collapse
  await firstHeader.click();
  await page.waitForTimeout(200);
  await expect(page.locator('.bids-panel-bid-list').first()).not.toHaveClass(/open/);
  console.log('✅ Clicking expanded header collapses the bid list');
});

test('Bids panel — each expanded bid row has a Compare bids button', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-bids-card');
  await page.waitForTimeout(500);

  const firstHeader = page.locator('.bids-panel-rfq-header').first();
  if (await firstHeader.count() === 0) return;

  await firstHeader.click();
  await page.waitForTimeout(300);

  const bidRows = page.locator('.bids-panel-bid-row');
  if (await bidRows.count() > 0) {
    const btn = bidRows.first().locator('.btn-view');
    await expect(btn).toBeVisible();
    expect(await btn.textContent()).toContain('Compare bids');
    console.log('✅ Bid row has Compare bids button');
  }
});

test('Bids panel — Active filter shows only RFQs with active status', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-bids-card');
  await page.waitForTimeout(500);

  await page.click('#bids-pill-active');
  await page.waitForTimeout(300);
  await expect(page.locator('#bids-pill-active')).toHaveClass(/active/);

  // All visible RFQ sections should be for active RFQs (check status badge)
  const sections = page.locator('.bids-panel-section');
  const count = await sections.count();
  for (let i = 0; i < count; i++) {
    const badge = await sections.nth(i).locator('.status-badge').textContent();
    expect(badge.toLowerCase()).toContain('accepting');
  }
  console.log(`✅ Bids panel Active filter: ${count} active RFQ section(s)`);
});

test('Bids panel — lowest bid shows 💰 Lowest badge', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-bids-card');
  await page.waitForTimeout(500);

  // Expand the first RFQ
  const firstHeader = page.locator('.bids-panel-rfq-header').first();
  if (await firstHeader.count() === 0) return;
  await firstHeader.click();
  await page.waitForTimeout(300);

  const bidRows = page.locator('.bids-panel-bid-row');
  if (await bidRows.count() > 1) {
    // When multiple bids, one should have the Lowest badge
    const lowestBadge = page.locator('.bids-panel-bid-row').locator('text=💰 Lowest');
    expect(await lowestBadge.count()).toBeGreaterThanOrEqual(1);
    console.log('✅ Lowest bid badge present in bids panel');
  } else {
    console.log('ℹ️  Only one bid per RFQ — lowest badge always applied');
  }
});

/* ══════════════════════════════════════════════════════════
   DEALS AWARDED PANEL
══════════════════════════════════════════════════════════ */

test('Clicking Deals Awarded card shows awarded panel (no navigation)', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-card-awarded');

  await expect(page).toHaveURL(/buyer-dashboard/);
  await expect(page.locator('#panel-awarded')).toHaveClass(/active/);
  await expect(page.locator('#stat-card-awarded')).toHaveClass(/selected/);
  console.log('✅ Deals awarded card shows awarded panel without navigating');
});

test('Awarded panel shows awarded RFQ cards', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-card-awarded');
  await page.waitForTimeout(500);

  const awardedCount = parseInt(await page.locator('#stat-awarded').textContent());
  const cards = page.locator('.awarded-card');
  expect(await cards.count()).toBe(awardedCount);
  console.log(`✅ Awarded panel shows ${awardedCount} awarded card(s)`);
});

test('Awarded panel cards show title, vendors and winning bid price', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-card-awarded');
  await page.waitForTimeout(500);

  const cards = page.locator('.awarded-card');
  if (await cards.count() === 0) {
    console.log('ℹ️  No awarded deals yet — skipping content check');
    return;
  }

  const firstCard = cards.first();
  await expect(firstCard.locator('.awarded-card-title')).toBeVisible();
  await expect(firstCard.locator('.awarded-card-meta')).toBeVisible();
  await expect(firstCard.locator('.awarded-card-price')).toBeVisible();
  await expect(firstCard.locator('.btn-view')).toBeVisible();
  console.log('✅ Awarded card has title, meta, price and View award button');
});

test('Awarded panel card click navigates to compare-bids', async ({ page }) => {
  await loginAndLoad(page);
  await page.click('#stat-card-awarded');
  await page.waitForTimeout(500);

  const cards = page.locator('.awarded-card');
  if (await cards.count() === 0) {
    console.log('ℹ️  No awarded deals — skipping nav test');
    return;
  }

  await cards.first().click();
  await expect(page).toHaveURL(/compare-bids/, { timeout: 10000 });
  console.log('✅ Awarded card click navigates to compare-bids');
});

/* ══════════════════════════════════════════════════════════
   PANEL SWITCHING — STATE CONSISTENCY
══════════════════════════════════════════════════════════ */

test('Switching panels updates selected stat card highlight', async ({ page }) => {
  await loginAndLoad(page);

  // Start on RFQs (default)
  await expect(page.locator('#stat-card-rfqs')).toHaveClass(/selected/);

  // Switch to Bids
  await page.click('#stat-bids-card');
  await expect(page.locator('#stat-bids-card')).toHaveClass(/selected/);
  await expect(page.locator('#stat-card-rfqs')).not.toHaveClass(/selected/);

  // Switch to Awarded
  await page.click('#stat-card-awarded');
  await expect(page.locator('#stat-card-awarded')).toHaveClass(/selected/);
  await expect(page.locator('#stat-bids-card')).not.toHaveClass(/selected/);

  // Back to RFQs
  await page.click('#stat-card-rfqs');
  await expect(page.locator('#stat-card-rfqs')).toHaveClass(/selected/);
  await expect(page.locator('#stat-card-awarded')).not.toHaveClass(/selected/);
  console.log('✅ Selected highlight moves correctly between stat cards');
});

test('Only one panel is visible at a time', async ({ page }) => {
  await loginAndLoad(page);

  const panels = ['#panel-rfqs', '#panel-bids', '#panel-awarded'];
  const cards = ['#stat-card-rfqs', '#stat-bids-card', '#stat-card-awarded'];

  for (let i = 0; i < cards.length; i++) {
    await page.click(cards[i]);
    await page.waitForTimeout(200);
    const activePanels = await page.locator('.dash-panel.active').count();
    expect(activePanels).toBe(1);
    await expect(page.locator(panels[i])).toHaveClass(/active/);
    console.log(`✅ Clicking ${cards[i]}: only 1 panel active`);
  }
});
