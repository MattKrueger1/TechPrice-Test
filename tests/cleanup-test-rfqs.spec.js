const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

test('delete all test RFQs', async ({ browser }) => {
  const buyerCtx    = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer       = await buyerCtx.newPage();
  const reseller    = await resellerCtx.newPage();

  async function login(page, email, pw) {
    await page.goto(`${BASE}/bidbridge-auth_1.html`);
    await page.fill('#login-email', email);
    await page.fill('#login-password', pw);
    await page.click('#login-btn');
    await page.waitForURL(/dashboard|reseller/, { timeout: 15000 });
  }

  await login(buyer, 'mattkrueger@comcast.net', 'Test12345678');
  await login(reseller, 'mk@comcast.net', 'Test12345678');

  // Do everything from inside the browser so the full Supabase session is live
  const result = await buyer.evaluate(async ({ url, key, resellerPage }) => {
    // Find all test RFQs
    const listResp = await fetch(`${url}/rest/v1/rfqs?select=id,title&order=created_at.asc`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${(await (await window.supabase?.auth?.getSession?.() ?? {}))?.data?.session?.access_token || key}` }
    });
    return listResp.json();
  }, { url: SUPABASE_URL, key: SUPABASE_KEY });

  // Use Supabase JS client directly in the browser for authenticated deletes
  const deleted = await buyer.evaluate(async ({ url, key }) => {
    const sb = supabase.createClient(url, key);

    // Find all test RFQs owned by this buyer
    const { data: allRfqs } = await sb.from('rfqs').select('id, title').order('created_at', { ascending: true });
    const testRfqs = (allRfqs || []).filter(r =>
      r.title.startsWith('EXEC_SUMMARY_TEST_') ||
      r.title.startsWith('SCREENSHOT_TEST_') ||
      r.title.startsWith('SMS_TEST_') ||
      r.title.startsWith('Import Test') ||
      (r.title.startsWith('Test ') && !r.title.includes('Refresh'))
    );

    const log = [];
    for (const rfq of testRfqs) {
      const id = rfq.id;
      await sb.from('bid_history').delete().eq('rfq_id', id);
      await sb.from('notifications').delete().eq('rfq_id', id);
      await sb.from('messages').delete().eq('rfq_id', id);
      await sb.from('bids').delete().eq('rfq_id', id);
      await sb.from('rfq_items').delete().eq('rfq_id', id);
      const { error } = await sb.from('rfqs').delete().eq('id', id);
      log.push({ title: rfq.title, error: error?.message || null });
    }
    return log;
  }, { url: SUPABASE_URL, key: SUPABASE_KEY });

  console.log('\nDeletion results:');
  deleted.forEach(d => console.log(d.error ? `  ✗ ${d.title}: ${d.error}` : `  ✓ ${d.title}`));

  // Reseller-owned tables: bid_history, bids — run from reseller context too
  const resellerDeleted = await reseller.evaluate(async ({ url, key }) => {
    const sb = supabase.createClient(url, key);
    // Try to delete any remaining bid_history / bids for test RFQs
    // (reseller is the owner of bids rows)
    const { data: myBids } = await sb.from('bids').select('id, rfq_id, rfqs(title)').order('created_at', { ascending: false });
    const testBids = (myBids || []).filter(b => {
      const title = b.rfqs?.title || '';
      return title.startsWith('EXEC_SUMMARY_TEST_') || title.startsWith('SCREENSHOT_TEST_');
    });
    for (const b of testBids) {
      await sb.from('bid_history').delete().eq('rfq_id', b.rfq_id);
      await sb.from('bids').delete().eq('id', b.id);
    }
    return testBids.length;
  }, { url: SUPABASE_URL, key: SUPABASE_KEY });
  console.log(`Cleaned ${resellerDeleted} orphaned reseller bid(s)`);

  // Verify
  const remaining = await buyer.evaluate(async ({ url, key }) => {
    const sb = supabase.createClient(url, key);
    const { data } = await sb.from('rfqs').select('title, status').order('created_at', { ascending: true });
    return data || [];
  }, { url: SUPABASE_URL, key: SUPABASE_KEY });

  console.log(`\n✅ Remaining RFQs (${remaining.length}):`);
  remaining.forEach(r => console.log(`  - [${r.status}] ${r.title}`));

  await buyerCtx.close();
  await resellerCtx.close();
});
