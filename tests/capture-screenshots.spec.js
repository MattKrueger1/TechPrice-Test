/**
 * Captures full-page screenshots of every buyer and reseller page.
 * Output: screenshots/ directory
 */
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT  = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const BUYER_PAGES = [
  { name: '01-auth',            url: '/bidbridge-auth_1.html' },
  { name: '02-buyer-dashboard', url: '/bidbridge-buyer-dashboard_2.html' },
  { name: '03-my-rfqs',         url: '/bidbridge-my-rfqs.html' },
  { name: '04-submit-rfq',      url: '/bidbridge-submit-rfq_2.html' },
  { name: '05-compare-bids',    url: '/bidbridge-compare-bids_1.html?rfq=7ca1c9b7-4c3b-4c62-89c0-ab20d6ebb6ea' },
  { name: '06-exec-summary',    url: '/bidbridge-exec-summary.html?rfq=7ca1c9b7-4c3b-4c62-89c0-ab20d6ebb6ea' },
  { name: '07-notifications',   url: '/bidbridge-notifications_1.html' },
  { name: '08-profile',         url: '/bidbridge-profile.html' },
  { name: '09-settings',        url: '/bidbridge-settings.html' },
];

const RESELLER_PAGES = [
  { name: '10-reseller-dashboard', url: '/bidbridge-reseller-dashboard.html' },
  { name: '11-reseller-profile',   url: '/bidbridge-reseller-profile.html' },
  { name: '12-reseller-apply',     url: '/bidbridge-reseller-apply_1.html' },
];

const PUBLIC_PAGES = [
  { name: '00-homepage',           url: '/index.html' },
  { name: '13-how-it-works',       url: '/how-it-works.html' },
  { name: '14-how-it-works-buyer', url: '/how-it-works-buyer.html' },
  { name: '15-how-it-works-reseller', url: '/how-it-works-reseller.html' },
];

test('Capture buyer pages', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login as buyer
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', 'mattkrueger@comcast.net');
  await page.fill('#login-password', 'Test12345678');
  await page.locator('#login-form').evaluate(f => f.requestSubmit());
  await page.waitForURL(/buyer-dashboard/, { timeout: 20000 });
  await page.waitForTimeout(2000);

  for (const { name, url } of BUYER_PAGES) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log(`✅ ${name}`);
  }
});

test('Capture reseller pages', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login as reseller
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', 'mk@comcast.net');
  await page.fill('#login-password', 'Test12345678');
  await page.locator('#login-form').evaluate(f => f.requestSubmit());
  await page.waitForURL(/reseller-dashboard/, { timeout: 20000 });
  await page.waitForTimeout(2000);

  for (const { name, url } of RESELLER_PAGES) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log(`✅ ${name}`);
  }
});

test('Capture public pages', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const { name, url } of PUBLIC_PAGES) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log(`✅ ${name}`);
  }
});
