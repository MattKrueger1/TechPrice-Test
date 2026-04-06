const { test } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

test('list rfqs', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-auth_1.html`);
  await page.fill('#login-email', 'mattkrueger@comcast.net');
  await page.fill('#login-password', 'Test12345678');
  await page.click('#login-btn');
  await page.waitForURL(/dashboard/, { timeout: 15000 });

  const token = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(k => k.includes('sb-') && k.includes('auth'));
    return k ? JSON.parse(localStorage.getItem(k))?.access_token : null;
  });

  const result = await page.evaluate(async ({ url, key, tok }) => {
    const resp = await fetch(`${url}/rest/v1/rfqs?select=id,title,status,created_at&order=created_at.asc`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${tok}` }
    });
    return resp.json();
  }, { url: SUPABASE_URL, key: SUPABASE_KEY, tok: token });

  console.log(JSON.stringify(result, null, 2));
});
