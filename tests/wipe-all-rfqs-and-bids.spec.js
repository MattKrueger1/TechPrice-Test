/**
 * WIPE ALL RFQs AND BIDS
 * Deletes every RFQ, bid, notification, and message — leaves all user accounts intact.
 * Run once then delete this file.
 *
 * Usage:
 *   npx playwright test tests/wipe-all-rfqs-and-bids.spec.js --reporter=list
 */

const { test } = require('@playwright/test');

const BASE        = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

const ACCOUNTS = [
  { email: 'mattkrueger@comcast.net', password: 'Test12345678', role: 'buyer'     },
  { email: 'mk@comcast.net',          password: 'Test12345678', role: 'reseller1' },
  { email: 'mk2@comcast.net',         password: 'Test12345678', role: 'reseller2' },
];

test.setTimeout(600000); // 10 min — wipe can be slow with large data sets

test('Wipe all RFQs, bids, notifications, and messages — keep accounts', async ({ browser }) => {

  // ── Login all accounts in parallel to get authenticated sessions ──
  const contexts = await Promise.all(ACCOUNTS.map(() => browser.newContext()));
  const pages    = await Promise.all(contexts.map(ctx => ctx.newPage()));

  for (let i = 0; i < ACCOUNTS.length; i++) {
    const { email, password } = ACCOUNTS[i];
    await pages[i].goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
    await pages[i].fill('#login-email', email);
    await pages[i].fill('#login-password', password);
    await pages[i].locator('#login-form').evaluate(f => f.requestSubmit());
    await pages[i].waitForURL(/dashboard|reseller/, { timeout: 20000 });
    console.log(`  Logged in: ${email}`);
  }

  const buyerPage     = pages[0];
  const reseller1Page = pages[1];
  const reseller2Page = pages[2];

  // Navigate to pages that have _supabase initialized so we can use the live client
  await buyerPage.waitForSelector('#stat-active, #rfq-list, h1', { timeout: 10000 });
  await reseller1Page.waitForSelector('#open-rfq-grid, h1', { timeout: 10000 });
  await reseller2Page.waitForSelector('#open-rfq-grid, h1', { timeout: 10000 });

  // ── Step 1: Delete reseller bids and bid_history (owned by resellers) ──
  for (const [idx, rPage] of [[1, reseller1Page], [2, reseller2Page]]) {
    const result = await rPage.evaluate(async ({ url, key }) => {
      const sb = window._supabase || supabase.createClient(url, key);
      const { data: myBids } = await sb.from('bids').select('id, rfq_id');
      const bids = myBids || [];
      let bhDeleted = 0, bDeleted = 0;
      for (const b of bids) {
        const { data: bhRows } = await sb.from('bid_history').delete().eq('rfq_id', b.rfq_id).select('id');
      const c1 = bhRows?.length || 0;
        bhDeleted += c1 || 0;
        const { error } = await sb.from('bids').delete().eq('id', b.id);
        if (!error) bDeleted++;
      }
      return { bids: bDeleted, bidHistory: bhDeleted };
    }, { url: SUPABASE_URL, key: SUPABASE_KEY });
    console.log(`  Reseller ${idx}: deleted ${result.bids} bid(s), ${result.bidHistory} bid_history row(s)`);
  }

  // ── Step 2: Delete all buyer-owned data from buyer session ──
  const summary = await buyerPage.evaluate(async ({ url, key }) => {
    // Use the already-authenticated page client — avoids session re-init issues
    const sb = window._supabase || supabase.createClient(url, key);

    // Get all RFQ IDs owned by this buyer
    const { data: rfqs } = await sb.from('rfqs').select('id, title');
    const rfqIds = (rfqs || []).map(r => r.id);
    const log = { rfqs: 0, bids: 0, bidHistory: 0, notifications: 0, messages: 0, rfqItems: 0 };

    if (rfqIds.length === 0) return { log, rfqs: [] };

    // Delete in dependency order
    for (const id of rfqIds) {
      await sb.from('bid_history').delete().eq('rfq_id', id);
      log.bidHistory++;

      await sb.from('bids').delete().eq('rfq_id', id);
      log.bids++;

      await sb.from('notifications').delete().eq('rfq_id', id);
      log.notifications++;

      await sb.from('messages').delete().eq('rfq_id', id);
      log.messages++;

      await sb.from('rfq_items').delete().eq('rfq_id', id);
      log.rfqItems++;

      // Use .select('id') to detect silent RLS failures (delete returns null error even when blocked)
      const { data: deleted, error } = await sb.from('rfqs').delete().eq('id', id).select('id');
      if (!error && deleted && deleted.length > 0) log.rfqs++;
      else if (error || !deleted?.length) log.rls = (log.rls || 0) + 1;
    }

    // Also wipe any stray notifications not tied to an RFQ
    await sb.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Verify what remains
    const { data: remaining } = await sb.from('rfqs').select('id, title, status');
    return { log, rfqs: rfqs.map(r => r.title), remaining: remaining || [] };
  }, { url: SUPABASE_URL, key: SUPABASE_KEY });

  console.log('\n── Deleted ──────────────────────────────');
  summary.rfqs.forEach(t => console.log(`  ✓ ${t}`));
  console.log(`\n  Total: ${summary.log.rfqs} RFQ(s), ${summary.log.rfqItems} rfq_item(s), bids/bid_history/notifications/messages wiped`);

  if (summary.remaining.length === 0) {
    console.log('\n✅ Database is clean — no RFQs remain');
  } else {
    console.warn('\n⚠️  Remaining RFQs (may be owned by other buyers):');
    summary.remaining.forEach(r => console.warn(`  [${r.status}] ${r.title}`));
  }

  await Promise.all(contexts.map(ctx => ctx.close()));
});
