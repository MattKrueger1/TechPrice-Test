/**
 * Save reseller2 (mk2@comcast.net) session for scale-vendor-auth tests.
 *   npx playwright test tests/refresh-reseller2-session.spec.js
 */
const { test } = require('@playwright/test');

const BASE  = 'http://localhost:3000';
const EMAIL = 'mk2@comcast.net';
const PASS  = 'Test12345678';

test('Save reseller2 session → reseller2-auth.json', async ({ page, context }) => {
  test.setTimeout(30000);
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASS);
  await page.locator('#login-form').evaluate(f => f.requestSubmit());
  await page.waitForURL(/reseller-dashboard/, { timeout: 20000 });
  await context.storageState({ path: 'reseller2-auth.json' });
  console.log('✅ Reseller 2 session saved to reseller2-auth.json');
});
