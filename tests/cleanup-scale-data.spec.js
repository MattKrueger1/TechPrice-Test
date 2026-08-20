/**
 * CLEANUP SCALE DATA
 * Removes everything created by seed-scale-data.spec.js (rows tagged "[SCALE] ").
 *
 * Usage:
 *   export SUPABASE_SERVICE_KEY="..."
 *   npx playwright test tests/cleanup-scale-data.spec.js --reporter=list
 */

const { test } = require('@playwright/test');

const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';
const SCALE_PREFIX = '[SCALE]%20';  // URL-encoded

test.setTimeout(120000);

test('Cleanup scale test data', async () => {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY not set');
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Prefer': 'return=representation',
  };

  // Get all RFQ IDs matching the scale prefix
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rfqs?title=like.${SCALE_PREFIX}*&select=id,title`, { headers });
  const rfqs = await res.json();
  console.log(`\n🧹 Found ${rfqs.length} scale test RFQs to remove\n`);

  let deleted = { rfqs: 0, items: 0, bids: 0, messages: 0, notifications: 0 };

  for (const rfq of rfqs) {
    for (const table of ['bid_history', 'bids', 'notifications', 'messages', 'rfq_items']) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?rfq_id=eq.${rfq.id}`, { method: 'DELETE', headers });
      const data = await r.json().catch(() => []);
      if (Array.isArray(data)) deleted[table === 'rfq_items' ? 'items' : table] = (deleted[table === 'rfq_items' ? 'items' : table] || 0) + data.length;
    }
    await fetch(`${SUPABASE_URL}/rest/v1/rfqs?id=eq.${rfq.id}`, { method: 'DELETE', headers });
    deleted.rfqs++;
  }

  console.log('✅ Cleanup complete');
  console.log('  RFQs deleted:          ' + deleted.rfqs);
  console.log('  Line items deleted:    ' + (deleted.items || 0));
  console.log('  Bids deleted:          ' + (deleted.bids || 0));
  console.log('  Messages deleted:      ' + (deleted.messages || 0));
  console.log('  Notifications deleted: ' + (deleted.notifications || 0));
  console.log('');
});
