/**
 * SCALE PERFORMANCE TEST
 * Measures page load times against a database populated by seed-scale-data.spec.js.
 *
 * Reports:
 *  - Time to first content render
 *  - Time to interactive (data loaded)
 *  - Number of items rendered per page
 *  - Flags any page taking > 3s (WARN) or > 5s (FAIL)
 *
 * Usage:
 *   1. Seed data first: npx playwright test tests/seed-scale-data.spec.js
 *   2. Run: npx playwright test tests/scale-performance.spec.js --reporter=list
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';

const WARN_THRESHOLD = 3000;  // ms
const FAIL_THRESHOLD = 5000;  // ms

const results = [];

async function timePageLoad(page, url, waitSelector, label, storageFile) {
  const start = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const domReady = Date.now() - start;

  let itemsRendered = 0;
  let dataLoaded = null;
  try {
    await page.waitForSelector(waitSelector, { timeout: 15000 });
    // Give page a moment for data to populate
    await page.waitForTimeout(2500);
    dataLoaded = Date.now() - start;

    // Count rendered items (rfq cards, list rows, etc.)
    itemsRendered = await page.evaluate(() => {
      const selectors = ['.rfq-card', '.bid-card', '.rfq-list-row', '[data-rfq-id]', 'tbody tr', '.attn-item'];
      let max = 0;
      for (const s of selectors) {
        const count = document.querySelectorAll(s).length;
        if (count > max) max = count;
      }
      return max;
    });
  } catch (err) {
    dataLoaded = Date.now() - start;
  }

  const result = {
    label,
    url,
    domReady,
    dataLoaded,
    itemsRendered,
    verdict: dataLoaded > FAIL_THRESHOLD ? 'FAIL' : dataLoaded > WARN_THRESHOLD ? 'WARN' : 'PASS',
  };
  results.push(result);

  const emoji = result.verdict === 'FAIL' ? '🔴' : result.verdict === 'WARN' ? '🟡' : '🟢';
  console.log(`  ${emoji} ${label.padEnd(40)} ${dataLoaded}ms (${itemsRendered} items) — ${result.verdict}`);
  return result;
}

test.setTimeout(300000);

test.describe('Buyer performance at scale', () => {
  test.use({ storageState: 'auth.json' });

  test('Buyer scale performance', async ({ page }) => {
    console.log('\n📊 Buyer performance at scale (with ~50 RFQs)\n');

    await timePageLoad(page, `${BASE}/bidbridge-buyer-dashboard_2.html`, '.stat-card', 'Buyer Dashboard');
    await timePageLoad(page, `${BASE}/bidbridge-my-rfqs.html`, 'body', 'My RFQs list');
    await timePageLoad(page, `${BASE}/bidbridge-compare-bids_1.html`, 'body', 'Compare Bids');
    await timePageLoad(page, `${BASE}/bidbridge-notifications_1.html`, 'body', 'Buyer Notifications');
  });
});

test.describe('Reseller 1 performance at scale', () => {
  test.use({ storageState: 'reseller-auth.json' });

  test('Reseller 1 scale performance', async ({ page }) => {
    console.log('\n📊 Reseller 1 (Cisco + Dell + Palo Alto) performance at scale\n');

    await timePageLoad(page, `${BASE}/bidbridge-reseller-dashboard.html`, '.stat-card', 'Reseller Dashboard');
    await timePageLoad(page, `${BASE}/bidbridge-reseller-open-rfqs.html`, '#open-rfq-grid', 'Browse Open RFQs');
    await timePageLoad(page, `${BASE}/bidbridge-reseller-my-bids.html`, '#bids-list', 'My Bids (all tabs)');
    await timePageLoad(page, `${BASE}/bidbridge-reseller-messages.html`, 'body', 'Reseller Messages');
  });
});

test.describe('Summary', () => {
  test('Print performance summary', async () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  PERFORMANCE SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const pass = results.filter(r => r.verdict === 'PASS').length;
    const warn = results.filter(r => r.verdict === 'WARN').length;
    const fail = results.filter(r => r.verdict === 'FAIL').length;

    console.log(`  🟢 ${pass} fast (< ${WARN_THRESHOLD}ms)`);
    console.log(`  🟡 ${warn} slow (${WARN_THRESHOLD}-${FAIL_THRESHOLD}ms)`);
    console.log(`  🔴 ${fail} too slow (> ${FAIL_THRESHOLD}ms)`);

    if (results.length > 0) {
      const avg = Math.round(results.reduce((s, r) => s + r.dataLoaded, 0) / results.length);
      const worst = results.reduce((w, r) => r.dataLoaded > w.dataLoaded ? r : w, results[0]);
      console.log(`\n  Average load: ${avg}ms`);
      console.log(`  Slowest:      ${worst.label} (${worst.dataLoaded}ms, ${worst.itemsRendered} items)`);
    }
    console.log('');
  });
});
