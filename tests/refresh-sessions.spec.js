/**
 * Run this once to refresh auth.json and reseller-auth.json when sessions expire.
 * Usage: npx playwright test tests/refresh-sessions.spec.js
 *
 * Credentials are read from env vars to avoid hardcoding:
 *   BUYER_EMAIL, BUYER_PASS, RESELLER_EMAIL, RESELLER_PASS
 *
 * Defaults fall back to known test accounts — update as needed.
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const BUYER_EMAIL    = process.env.BUYER_EMAIL    || 'mattkrueger@comcast.net';
const BUYER_PASS     = process.env.BUYER_PASS     || '';
const RESELLER_EMAIL = process.env.RESELLER_EMAIL || '';
const RESELLER_PASS  = process.env.RESELLER_PASS  || '';

test('Save buyer session → auth.json', async ({ page, context }) => {
  test.setTimeout(30000);
  test.skip(!BUYER_PASS, 'Set BUYER_PASS env var to run this session refresh');
  if (!BUYER_PASS) return;

  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', BUYER_EMAIL);
  await page.fill('#login-password', BUYER_PASS);
  await page.locator('#login-form').evaluate(f => f.requestSubmit());

  // Wait for redirect to dashboard
  await page.waitForURL(/buyer-dashboard_2/, { timeout: 20000 });
  await context.storageState({ path: 'auth.json' });
  console.log('✅ Buyer session saved to auth.json');
});

test('Save reseller session → reseller-auth.json', async ({ page, context }) => {
  test.setTimeout(30000);
  test.skip(!RESELLER_PASS || !RESELLER_EMAIL, 'Set RESELLER_EMAIL and RESELLER_PASS env vars to run this session refresh');
  if (!RESELLER_PASS || !RESELLER_EMAIL) return;

  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', RESELLER_EMAIL);
  await page.fill('#login-password', RESELLER_PASS);
  await page.locator('#login-form').evaluate(f => f.requestSubmit());

  // Wait for redirect to reseller dashboard
  await page.waitForURL(/reseller-dashboard/, { timeout: 20000 });
  await context.storageState({ path: 'reseller-auth.json' });
  console.log('✅ Reseller session saved to reseller-auth.json');
});
