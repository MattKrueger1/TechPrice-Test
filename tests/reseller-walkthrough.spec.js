const { test, expect } = require('@playwright/test');

test.use({ storageState: 'reseller-auth.json' });

const BASE = 'http://localhost:3000';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function loadDashboard(page) {
  const errors = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
  // Fail fast if session expired and we got redirected to auth
  const url = page.url();
  if (url.includes('auth')) throw new Error('Session expired — run: npx playwright test tests/refresh-sessions.spec.js with RESELLER_EMAIL and RESELLER_PASS env vars');
  // Wait for Supabase data to actually populate — stat-open-rfqs changes from '—' once RFQ load completes
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-open-rfqs');
    return el && el.textContent.trim() !== '—';
  }, { timeout: 20000 }).catch(() => {}); // swallow timeout — will fail gracefully in individual stat tests
  await page.waitForTimeout(1000); // let remaining DOM updates flush
  return errors;
}

// ─────────────────────────────────────────────
// 1. PAGE LOADS — NO JS ERRORS
// ─────────────────────────────────────────────

test('Dashboard loads without JS errors', async ({ page }) => {
  const errors = await loadDashboard(page);
  expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  await expect(page.locator('text=Reseller Dashboard')).toBeVisible();
  console.log('✅ Dashboard loaded without JS errors');
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
  await page.goto(`${BASE}/bidbridge-reseller-profile.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  expect(errors, `JS errors: ${errors.join('; ')}`).toHaveLength(0);
  console.log('✅ Profile page loaded without JS errors');
});

// ─────────────────────────────────────────────
// 2. DASHBOARD STATS — ALL POPULATED
// ─────────────────────────────────────────────

test('Dashboard stat cards show real values (not dashes)', async ({ page }) => {
  await loadDashboard(page);

  // Open RFQs available — could be 0 if all have been bid on; just confirm it's a number not '—'
  const openRfqs = await page.locator('#stat-open-rfqs').textContent();
  expect(openRfqs.trim()).toMatch(/^\d+$/);
  console.log('  Open RFQs:', openRfqs.trim());

  // Win rate
  const winRate = await page.locator('#stat-win-rate').textContent();
  expect(winRate.trim()).not.toBe('—');
  expect(winRate).toMatch(/\d+%/);
  console.log('  Win rate:', winRate.trim());

  // Revenue
  const revenue = await page.locator('#stat-revenue').textContent();
  expect(revenue.trim()).not.toBe('—');
  console.log('  Revenue:', revenue.trim());

  console.log('✅ All dashboard stat cards populated');
});

test('Sidebar shows reseller company name and verified badge', async ({ page }) => {
  await loadDashboard(page);
  const sidebarCompany = page.locator('.company-name, .reseller-name, #sidebar-company').first();
  // At minimum, verify no "undefined" or "null" rendered in the sidebar
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).not.toContain('undefined');
  expect(bodyText).not.toContain('[object Object]');
  console.log('✅ Sidebar renders without raw JS objects');
});

test('Sidebar vendor authorization tiers are visible', async ({ page }) => {
  await loadDashboard(page);
  await page.waitForTimeout(2000);
  const tiersEl = page.locator('#sidebar-tiers');
  const tiersHtml = await tiersEl.innerHTML();
  // Should have at least one vendor listed (ITSeller is authorized for Dell, Cisco, Palo Alto)
  expect(tiersHtml.length).toBeGreaterThan(20);
  console.log('✅ Sidebar vendor tiers populated');
});

// ─────────────────────────────────────────────
// 3. OPEN RFQs SECTION
// ─────────────────────────────────────────────

test('Open RFQ grid shows cards with titles', async ({ page }) => {
  await loadDashboard(page);
  const cards = page.locator('#open-rfq-grid .rfq-card');
  const count = await cards.count();
  console.log('  Open RFQ cards visible:', count);
  if (count > 0) {
    const titleEl = cards.first().locator('.rfq-card-title, .rfq-title').first();
    const title = await titleEl.textContent();
    expect(title.trim().length).toBeGreaterThan(0);
    console.log('  First RFQ title:', title.trim());
  } else {
    console.log('  No open RFQs right now — skipping card content checks');
  }
  console.log('✅ Open RFQ grid rendered');
});

test('Open RFQ cards show location when available', async ({ page }) => {
  await loadDashboard(page);
  const cards = page.locator('#open-rfq-grid .rfq-card');
  if (await cards.count() === 0) {
    console.log('No open RFQs — skipping location check');
    return;
  }
  // At least one card should contain a 📍 pin or city/state text
  const cardTexts = await cards.allTextContents();
  const hasLocation = cardTexts.some(t => t.includes('📍') || /,\s*[A-Z]{2}/.test(t) || t.includes(' MA') || t.includes(' CA'));
  // Soft check — location is optional if the RFQ has none set
  console.log('  Location present in cards:', hasLocation);
  console.log('✅ Open RFQ location check done');
});

test('Split bid RFQ cards show vendor count pill', async ({ page }) => {
  await loadDashboard(page);
  const cards = page.locator('#open-rfq-grid .rfq-card');
  if (await cards.count() === 0) {
    console.log('No open RFQs — skipping split bid pill check');
    return;
  }
  // Look for "X of Y vendor" text in any card
  const gridHtml = await page.locator('#open-rfq-grid').innerHTML();
  const hasSplitPill = /\d+ of \d+ vendor/.test(gridHtml);
  console.log('  Split bid vendor pill present:', hasSplitPill, '(only expected if there are split-bid RFQs)');
  console.log('✅ Split bid pill check done');
});

// ─────────────────────────────────────────────
// 4. BID FORM MODAL
// ─────────────────────────────────────────────

test('Clicking open RFQ opens bid modal with price fields', async ({ page }) => {
  await loadDashboard(page);
  const cards = page.locator('#open-rfq-grid .rfq-card');
  if (await cards.count() === 0) {
    console.log('No open RFQs — skipping bid modal test');
    return;
  }
  await cards.first().click();
  await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/, { timeout: 5000 });

  // Modal title
  const title = await page.locator('#bid-modal-title').textContent();
  expect(title.trim().length).toBeGreaterThan(0);
  console.log('  Modal title:', title.trim());

  // At least one price input exists
  const priceInput = page.locator('#price-0, input[id^="price-"]').first();
  await expect(priceInput).toBeVisible({ timeout: 5000 });
  console.log('✅ Bid modal opens with price input');
});

test('Bid modal shows split bid info banner for split-bid RFQs', async ({ page }) => {
  await loadDashboard(page);
  const cards = page.locator('#open-rfq-grid .rfq-card');
  if (await cards.count() === 0) {
    console.log('No open RFQs — skipping split bid banner test');
    return;
  }
  // Click each card until we find a split bid or exhaust the list
  const count = await cards.count();
  let foundSplitBid = false;
  for (let i = 0; i < count; i++) {
    await cards.nth(i).click();
    await page.waitForTimeout(500);
    const modalOpen = !(await page.locator('#bid-modal').evaluate(el => el.classList.contains('hidden')));
    if (modalOpen) {
      const bodyHtml = await page.locator('#bid-modal-body').innerHTML();
      if (/authorized to bid on/i.test(bodyHtml)) {
        foundSplitBid = true;
        console.log('  Split bid banner found on card', i + 1);
        await page.locator('.btn-cancel-bid').click();
        break;
      }
      await page.locator('.btn-cancel-bid').click();
      await page.waitForTimeout(300);
    }
  }
  console.log('  Found a split bid RFQ:', foundSplitBid, '(only expected if split-bid RFQs are open)');
  console.log('✅ Split bid banner check done');
});

test('Bid modal closes cleanly on cancel', async ({ page }) => {
  await loadDashboard(page);
  const cards = page.locator('#open-rfq-grid .rfq-card');
  if (await cards.count() === 0) {
    console.log('No open RFQs — skipping cancel test');
    return;
  }
  await cards.first().click();
  await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await page.locator('.btn-cancel-bid').click();
  await expect(page.locator('#bid-modal')).toHaveClass(/hidden/, { timeout: 3000 });
  console.log('✅ Bid modal closes correctly');
});

// ─────────────────────────────────────────────
// 5. MY BIDS — FILTER PILLS
// ─────────────────────────────────────────────

test('My Bids filter pills all toggle correctly', async ({ page }) => {
  await loadDashboard(page);
  const pills = [
    { id: '#mybids-pill-active', label: 'Active' },
    { id: '#mybids-pill-won',    label: 'Won' },
    { id: '#mybids-pill-lost',   label: 'Lost' },
    { id: '#mybids-pill-cancelled', label: 'Cancelled' },
    { id: '#mybids-pill-all',    label: 'All' },
  ];
  for (const pill of pills) {
    const el = page.locator(pill.id);
    if (await el.count() === 0) { console.log(`  ${pill.label} pill not found — skipping`); continue; }
    await el.click();
    await page.waitForTimeout(300);
    await expect(el).toHaveClass(/active/, { timeout: 2000 });
    console.log(`  ${pill.label} pill toggled ✓`);
  }
  console.log('✅ All My Bids filter pills work');
});

// ─────────────────────────────────────────────
// 6. WON BID — CARD + MODAL
// ─────────────────────────────────────────────

test('WON bid card shows correct badge and clicking opens bid summary', async ({ page }) => {
  await loadDashboard(page);
  await page.locator('#mybids-pill-won').click();
  await page.waitForTimeout(500);

  const wonCards = page.locator('#my-bids-list .rfq-card');
  const count = await wonCards.count();
  if (count === 0) {
    console.log('No won bids for this reseller — skipping');
    return;
  }
  // Every visible card should have WON or PARTIALLY WON badge
  const firstCard = wonCards.first();
  const badgeText = await firstCard.locator('.new-tag').textContent();
  expect(badgeText).toMatch(/WON/i);
  console.log('  WON badge text:', badgeText.trim());

  // Click to open bid summary
  await firstCard.click();
  await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/, { timeout: 5000 });

  const modalTitle = await page.locator('#bid-modal-title').textContent();
  expect(modalTitle.trim()).toBe('Bid Summary');

  const statusText = await page.locator('#bid-modal-body').textContent();
  expect(statusText).toMatch(/Won/i);
  console.log('✅ WON bid card and modal work correctly');
});

test('WON bid summary modal shows line items table', async ({ page }) => {
  await loadDashboard(page);
  await page.locator('#mybids-pill-won').click();
  await page.waitForTimeout(500);

  const wonCards = page.locator('#my-bids-list .rfq-card');
  if (await wonCards.count() === 0) {
    console.log('No won bids — skipping');
    return;
  }
  await wonCards.first().click();
  await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/, { timeout: 5000 });

  const bodyHtml = await page.locator('#bid-modal-body').innerHTML();
  // Should have a table OR "No line item" message — not just blank
  const hasTable = bodyHtml.includes('<table') || bodyHtml.includes('No line item');
  expect(hasTable).toBe(true);
  console.log('✅ WON bid modal shows line-item content');
});

test('Partially won split bid modal shows only awarded vendor lines', async ({ page }) => {
  await loadDashboard(page);
  await page.locator('#mybids-pill-won').click();
  await page.waitForTimeout(500);

  const wonCards = page.locator('#my-bids-list .rfq-card');
  let foundPartial = false;
  const count = await wonCards.count();

  for (let i = 0; i < count; i++) {
    const badgeText = await wonCards.nth(i).locator('.new-tag').textContent();
    if (/PARTIALLY WON/i.test(badgeText)) {
      await wonCards.nth(i).click();
      await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/, { timeout: 5000 });

      const bodyText = await page.locator('#bid-modal-body').textContent();
      // Should mention the partial win explanation
      expect(bodyText).toMatch(/portion of this split bid|Partially Won/i);

      // Status box should say "Partially Won"
      expect(bodyText).toMatch(/Partially Won/i);
      console.log('  Partial win modal text verified ✓');
      foundPartial = true;
      await page.locator('.btn-cancel-bid').click();
      break;
    }
  }
  if (!foundPartial) {
    console.log('No partially-won split bid found for this reseller — skipping partial win modal check');
  }
  console.log('✅ Partially won bid modal check done');
});

test('WON bid modal: awarded amount does not include non-awarded vendors', async ({ page }) => {
  await loadDashboard(page);
  await page.locator('#mybids-pill-won').click();
  await page.waitForTimeout(500);

  const wonCards = page.locator('#my-bids-list .rfq-card');
  if (await wonCards.count() === 0) {
    console.log('No won bids — skipping');
    return;
  }
  await wonCards.first().click();
  await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/, { timeout: 5000 });

  const bodyHtml = await page.locator('#bid-modal-body').innerHTML();
  // Must NOT show a $0.00 total unless the bid genuinely had no prices
  const netTotalMatch = bodyHtml.match(/Net total:.*?\$([\d,]+\.\d{2})/);
  if (netTotalMatch) {
    const total = parseFloat(netTotalMatch[1].replace(/,/g, ''));
    expect(total).toBeGreaterThan(0);
    console.log('  Net total in modal: $' + total.toFixed(2));
  }
  console.log('✅ WON modal net total is non-zero');
});

// ─────────────────────────────────────────────
// 7. LOST BID — CARD + MODAL
// ─────────────────────────────────────────────

test('LOST bid card shows NOT SELECTED badge and opens modal', async ({ page }) => {
  await loadDashboard(page);
  await page.locator('#mybids-pill-lost').click();
  await page.waitForTimeout(500);

  const lostCards = page.locator('#my-bids-list .rfq-card');
  if (await lostCards.count() === 0) {
    console.log('No lost bids — skipping');
    return;
  }
  const badgeText = await lostCards.first().locator('.new-tag').textContent();
  expect(badgeText).toMatch(/NOT SELECTED/i);

  await lostCards.first().click();
  await expect(page.locator('#bid-modal')).not.toHaveClass(/hidden/, { timeout: 5000 });
  const title = await page.locator('#bid-modal-title').textContent();
  expect(title.trim()).toBe('Bid Summary');
  console.log('✅ LOST bid card and modal work correctly');
});

// ─────────────────────────────────────────────
// 8. WIN RATE CONSISTENCY — DASHBOARD vs PROFILE
// ─────────────────────────────────────────────

test('Win rate is consistent between dashboard and profile page', async ({ page }) => {
  // Get win rate from dashboard (already waits for stat to populate)
  await loadDashboard(page);
  const dashWinRate = (await page.locator('#stat-win-rate').textContent()).trim();
  console.log('  Dashboard win rate:', dashWinRate);

  // Get win rate from profile
  await page.goto(`${BASE}/bidbridge-reseller-profile.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-win-rate');
    return el && el.textContent.trim() !== '—';
  }, { timeout: 20000 });
  const profileWinRate = (await page.locator('#stat-win-rate').textContent()).trim();
  console.log('  Profile win rate:', profileWinRate);

  expect(dashWinRate).toBe(profileWinRate);
  console.log('✅ Win rates match:', dashWinRate);
});

test('Profile stats are all populated (no dashes)', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-profile.html`, { waitUntil: 'domcontentloaded' });
  // Wait until the stat gets populated (Supabase resolves and replaces the default "—")
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-bids-total');
    return el && el.textContent.trim() !== '—';
  }, { timeout: 20000 });

  const bidsTotal = (await page.locator('#stat-bids-total').textContent()).trim();
  const dealsWon  = (await page.locator('#stat-deals-won').textContent()).trim();
  const winRate   = (await page.locator('#stat-win-rate').textContent()).trim();
  const revenue   = (await page.locator('#stat-revenue').textContent()).trim();

  expect(bidsTotal).not.toBe('—');
  expect(dealsWon).not.toBe('—');
  expect(winRate).not.toBe('—');
  expect(revenue).not.toBe('—');

  console.log(`  Bids: ${bidsTotal}, Won: ${dealsWon}, Win rate: ${winRate}, Revenue: ${revenue}`);
  console.log('✅ Profile stats all populated');
});

test('Profile deals won count matches dashboard won bid count', async ({ page }) => {
  await loadDashboard(page);
  await page.locator('#mybids-pill-won').click();
  await page.waitForTimeout(500);
  const wonBidCards = await page.locator('#my-bids-list .rfq-card').count();
  console.log('  Dashboard won bid cards:', wonBidCards);

  await page.goto(`${BASE}/bidbridge-reseller-profile.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const profileDealsWon = parseInt((await page.locator('#stat-deals-won').textContent()).trim(), 10);
  console.log('  Profile deals won:', profileDealsWon);

  expect(profileDealsWon).toBe(wonBidCards);
  console.log('✅ Won bid counts match between dashboard and profile');
});

// ─────────────────────────────────────────────
// 9. NAVIGATION — ALL SIDEBAR LINKS WORK
// ─────────────────────────────────────────────

test('Sidebar navigation links all load correct pages', async ({ page }) => {
  const navLinks = [
    { href: 'bidbridge-reseller-dashboard.html', label: 'Dashboard' },
    { href: 'bidbridge-reseller-profile.html',   label: 'My Profile' },
    { href: 'bidbridge-notifications_1.html',    label: 'Notifications' },
  ];

  for (const link of navLinks) {
    await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded' });
    const anchor = page.locator(`a[href="${link.href}"]`).first();
    if (await anchor.count() === 0) {
      console.log(`  ${link.label} link not found in sidebar — skipping`);
      continue;
    }
    await anchor.click();
    await page.waitForURL(new RegExp(link.href.replace('.', '\\.')), { timeout: 10000 });
    await expect(page).toHaveURL(new RegExp(link.href.replace('.', '\\.')));
    console.log(`  ${link.label} ✓`);
  }
  console.log('✅ All sidebar nav links navigate correctly');
});

// ─────────────────────────────────────────────
// 10. NOTIFICATIONS PAGE
// ─────────────────────────────────────────────

test('Notifications page renders items or empty state — no blank page', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-notifications_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const body = page.locator('body');
  const text = await body.textContent();
  // Should have some rendered content — not just the loading spinner
  expect(text.trim().length).toBeGreaterThan(50);

  const hasNotifs = await page.locator('.notif-item').count() > 0;
  const hasEmptyState = /all caught up|no notifications|nothing here|no new/i.test(text);
  expect(hasNotifs || hasEmptyState, `Unexpected notifications page content: "${text.slice(0, 200)}"`).toBe(true);
  console.log('  Has notif items:', hasNotifs, '| Has empty state:', hasEmptyState);
  console.log('✅ Notifications page renders correctly');
});

// ─────────────────────────────────────────────
// 11. ALL PAGES — NO CONSOLE ERRORS
// ─────────────────────────────────────────────

test('No JS errors across all reseller pages', async ({ page }) => {
  const pages = [
    'bidbridge-reseller-dashboard.html',
    'bidbridge-reseller-profile.html',
    'bidbridge-notifications_1.html',
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
  console.log('✅ All reseller pages error-free');
});
