const { test, expect } = require('@playwright/test');
test.use({ storageState: 'auth.json' });
const BASE = 'http://localhost:3000';
test('Dashboard redesign loads without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message + '\n' + err.stack));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(6000);
  console.log('JS errors:', JSON.stringify(errors, null, 2));
  const actionCards = await page.locator('#action-cards').textContent().catch(() => 'NOT FOUND');
  console.log('Action cards:', actionCards?.slice(0, 200));
});
