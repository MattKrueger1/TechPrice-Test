/**
 * SEED SCALE DATA
 * Populates the DB with realistic volume for performance + UX-at-scale testing.
 *
 *  50 RFQs seeded, distribution:
 *    - 20 sole-source single-vendor RFQs
 *    - 25 split multi-vendor RFQs (2-4 vendors each)
 *    -  5 RFQs with vendors NEITHER test reseller is authorized for
 *       (verifies filtering — these should NOT appear on either reseller dashboard)
 *
 *  ~200 bids from both resellers across the RFQs they're authorized for.
 *  Status mix: active, review, awarded, closed, cancelled.
 *  Messages on ~30% of RFQs.
 *  Notifications for both sides.
 *
 * Test resellers and their vendors:
 *   Reseller 1 (mk@comcast.net):   Cisco + Dell Technologies + Palo Alto Networks
 *   Reseller 2 (mk2@comcast.net):  Dell Technologies only
 *
 * Usage:
 *   export SUPABASE_SERVICE_KEY="..."
 *   npx playwright test tests/seed-scale-data.spec.js --reporter=list
 *
 * All seeded rows are tagged with a title prefix "[SCALE] " so they're easy
 * to identify and clean up via tests/cleanup-scale-data.spec.js.
 */

const { test } = require('@playwright/test');

const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';

const BUYER     = { email: 'mattkrueger@comcast.net', id: '46ea832d-5c57-4570-955b-50438f634d8c' };
const RESELLER1 = { email: 'mk@comcast.net',          id: 'ad52644c-96d8-4936-a5a5-8c82c1c56851', vendors: ['Cisco', 'Dell Technologies', 'Palo Alto Networks'] };
const RESELLER2 = { email: 'mk2@comcast.net',         id: 'c7961587-bbc5-411a-bd86-40f4f3f61076', vendors: ['Dell Technologies'] };

const SCALE_PREFIX = '[SCALE] ';

// Vendor pool: mix of what resellers ARE authorized for + some they aren't
const AUTHORIZED_VENDORS   = ['Cisco', 'Dell Technologies', 'Palo Alto Networks'];
const UNAUTHORIZED_VENDORS = ['Fortinet', 'Juniper', 'HP', 'Aruba', 'Lenovo'];
const ALL_VENDORS = [...AUTHORIZED_VENDORS, ...UNAUTHORIZED_VENDORS];

// Realistic SKUs per vendor
const SKUS = {
  'Cisco':               ['C9200-48P-A', 'C9300-24T-E', 'C9500-16X-E', 'CBS350-24T-4G'],
  'Dell Technologies':   ['PE-R750',     'PE-R650XS',  'PowerVault-ME5', 'OptiPlex-7010'],
  'Palo Alto Networks':  ['PA-1410',     'PA-3410',    'PA-460',        'PA-5410'],
  'Fortinet':            ['FG-100F',     'FG-200F',    'FG-60F',        'FG-40F'],
  'Juniper':             ['EX4300-48T',  'EX2300-48P', 'SRX345',        'SRX380'],
  'HP':                  ['DL380-Gen11', 'DL360-Gen11','MicroServer',   'HP-Aruba-2530'],
  'Aruba':               ['AP-635',      'AP-505',     'CX-6100',       'CX-6300'],
  'Lenovo':              ['SR650-V3',    'SR630-V3',   'ST250-V2',      'M90n-Nano'],
};

const RFQ_TITLES = [
  'Network switch refresh',
  'Data center server procurement',
  'Firewall upgrade',
  'Wireless infrastructure buildout',
  'Storage array expansion',
  'Branch office network refresh',
  'Campus fabric modernization',
  'SD-WAN deployment hardware',
  'End-user compute refresh',
  'Server consolidation',
  'Virtual desktop infrastructure',
  'DR site hardware',
  'Edge networking rollout',
  'Cloud gateway hardware',
  'Cybersecurity infrastructure',
  'IoT gateway deployment',
  'Video conferencing hardware',
  'Backup infrastructure upgrade',
];

const LOCATIONS = ['Austin, TX', 'Chicago, IL', 'New York, NY', 'San Francisco, CA', 'Denver, CO', 'Atlanta, GA', 'Seattle, WA', 'Boston, MA'];

test.setTimeout(600000);

async function restPost(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(row),
  });
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function restPatch(table, filter, row) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(row),
  });
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randPrice(base, spread = 0.3) {
  return +(base * (1 + (Math.random() * spread - spread / 2))).toFixed(2);
}
function daysFromNow(d) {
  const now = new Date();
  now.setDate(now.getDate() + d);
  return now.toISOString().slice(0, 10);
}

test('Seed scale test data — 50 RFQs, ~200 bids, multi-vendor mix', async () => {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY not set');
  console.log('\n🌱 Seeding scale test data...\n');

  const stats = {
    rfqsCreated: 0,
    itemsCreated: 0,
    bidsCreated: 0,
    messagesCreated: 0,
    notifsCreated: 0,
    soleSource: 0,
    splitMultiVendor: 0,
    filterTestRfqs: 0,
  };

  // ── Build the 50 RFQs with a realistic mix ────────────────────────────
  const rfqPlans = [];

  // 20 sole-source RFQs
  for (let i = 0; i < 20; i++) {
    const vendor = pick(ALL_VENDORS);
    const status = pick(['active', 'active', 'active', 'review', 'awarded', 'closed', 'cancelled']);
    rfqPlans.push({
      title:    `${SCALE_PREFIX}${pick(RFQ_TITLES)} — ${vendor}`,
      strategy: 'sole',
      vendors:  [vendor],
      status,
      deadline: daysFromNow([-30, -14, 3, 7, 14, 21, 30][Math.floor(Math.random() * 7)]),
    });
    stats.soleSource++;
  }

  // 25 split multi-vendor RFQs (2-4 vendors)
  for (let i = 0; i < 25; i++) {
    const numVendors = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4
    const vendors    = pickN(ALL_VENDORS, numVendors);
    const status     = pick(['active', 'active', 'active', 'review', 'awarded']);
    rfqPlans.push({
      title:    `${SCALE_PREFIX}${pick(RFQ_TITLES)} — Multi-vendor (${vendors.length})`,
      strategy: 'split',
      vendors,
      status,
      deadline: daysFromNow([3, 7, 14, 21, 30][Math.floor(Math.random() * 5)]),
    });
    stats.splitMultiVendor++;
  }

  // 5 RFQs with vendors NEITHER test reseller is authorized for
  // These MUST NOT appear on either reseller's dashboard (filter validation)
  for (let i = 0; i < 5; i++) {
    const numVendors = 1 + Math.floor(Math.random() * 2);
    const vendors    = pickN(UNAUTHORIZED_VENDORS, numVendors);
    rfqPlans.push({
      title:    `${SCALE_PREFIX}FILTER-TEST — ${vendors.join(' + ')} (should not appear)`,
      strategy: numVendors > 1 ? 'split' : 'sole',
      vendors,
      status:   'active',
      deadline: daysFromNow(14),
    });
    stats.filterTestRfqs++;
  }

  // ── Insert all RFQs and their items ───────────────────────────────────
  for (const plan of rfqPlans) {
    const rfq = await restPost('rfqs', {
      buyer_id:    BUYER.id,
      title:       plan.title,
      status:      plan.status,
      strategy:    plan.strategy,
      hq_location: pick(LOCATIONS),
      deadline:    plan.deadline,
      notes:       'Scale test — auto-generated for performance and volume testing.',
    });
    if (!rfq?.id) { console.log(`  ⚠ Failed RFQ: ${plan.title}`); continue; }
    stats.rfqsCreated++;
    plan.rfqId = rfq.id;

    // Add line items for each vendor
    for (const vendor of plan.vendors) {
      const numLines = 1 + Math.floor(Math.random() * 3); // 1-3 SKUs per vendor
      const skus = pickN(SKUS[vendor] || [`${vendor}-SKU-${Date.now()}`], numLines);
      for (const sku of skus) {
        await restPost('rfq_items', {
          rfq_id:      rfq.id,
          vendor,
          sku,
          quantity:    1 + Math.floor(Math.random() * 20),
          description: `${vendor} ${sku}`,
        });
        stats.itemsCreated++;
      }
    }

    // ── Seed bids for authorized resellers ───────────────────────────────
    // A reseller can bid on an RFQ if it contains AT LEAST ONE vendor they're authorized for
    const r1Overlap = plan.vendors.filter(v => RESELLER1.vendors.includes(v));
    const r2Overlap = plan.vendors.filter(v => RESELLER2.vendors.includes(v));

    if (r1Overlap.length > 0 && plan.status !== 'cancelled') {
      // 80% chance Reseller 1 has submitted a bid
      if (Math.random() < 0.8) {
        const bidPrice = randPrice(5000 + Math.random() * 45000);
        const lineItems = r1Overlap.map(v => ({
          vendor: v,
          sku: pick(SKUS[v] || []),
          quantity: 5,
          unit_price: randPrice(1000),
          line_total: randPrice(5000),
        }));
        let bidStatus = 'pending';
        if (plan.status === 'awarded') bidStatus = Math.random() < 0.5 ? 'accepted' : 'rejected';
        if (plan.status === 'closed') bidStatus = 'rejected';

        const bid = await restPost('bids', {
          rfq_id: plan.rfqId,
          reseller_id: RESELLER1.id,
          total_price: bidPrice,
          status: bidStatus,
          line_items: lineItems,
        });
        if (bid?.id) {
          stats.bidsCreated++;
          plan.r1BidId = bid.id;

          // If awarded and this is the winning bid, set vendor_awards
          if (plan.status === 'awarded' && bidStatus === 'accepted') {
            const awards = {};
            for (const v of r1Overlap) awards[v] = bid.id;
            await restPatch('rfqs', `id=eq.${plan.rfqId}`, { vendor_awards: awards });
          }
        }
      }
    }

    if (r2Overlap.length > 0 && plan.status !== 'cancelled') {
      // 60% chance Reseller 2 has bid (they only do Dell, so less coverage)
      if (Math.random() < 0.6) {
        const bidPrice = randPrice(3000 + Math.random() * 30000);
        const lineItems = r2Overlap.map(v => ({
          vendor: v,
          sku: pick(SKUS[v] || []),
          quantity: 5,
          unit_price: randPrice(1000),
          line_total: randPrice(5000),
        }));
        let bidStatus = 'pending';
        if (plan.status === 'awarded') bidStatus = Math.random() < 0.3 ? 'accepted' : 'rejected';
        if (plan.status === 'closed') bidStatus = 'rejected';

        const bid = await restPost('bids', {
          rfq_id: plan.rfqId,
          reseller_id: RESELLER2.id,
          total_price: bidPrice,
          status: bidStatus,
          line_items: lineItems,
        });
        if (bid?.id) {
          stats.bidsCreated++;
          plan.r2BidId = bid.id;
        }
      }
    }

    // ── Seed messages on ~30% of RFQs ────────────────────────────────────
    if (Math.random() < 0.3 && (plan.r1BidId || plan.r2BidId)) {
      const talker = plan.r1BidId ? RESELLER1 : RESELLER2;
      await restPost('messages', {
        rfq_id: plan.rfqId,
        sender_id: BUYER.id,
        body: 'Hi — quick question on your bid, do you have stock available for the timeline in the RFQ?',
      });
      await restPost('messages', {
        rfq_id: plan.rfqId,
        sender_id: talker.id,
        body: 'Yes, we have all units in stock and can ship next-day. Happy to jump on a call.',
      });
      stats.messagesCreated += 2;

      // Notify buyer of the reply
      await restPost('notifications', {
        user_id: BUYER.id,
        type: 'new_message',
        message: `New message on "${plan.title.replace(SCALE_PREFIX, '')}"`,
        rfq_id: plan.rfqId,
        read: false,
      });
      stats.notifsCreated++;
    }

    // ── Seed new_rfq notifications for authorized resellers ─────────────
    if (plan.status === 'active') {
      if (r1Overlap.length > 0) {
        await restPost('notifications', {
          user_id: RESELLER1.id,
          type: 'new_rfq',
          message: `New RFQ: ${plan.title.replace(SCALE_PREFIX, '')}`,
          rfq_id: plan.rfqId,
          read: Math.random() < 0.4,
        });
        stats.notifsCreated++;
      }
      if (r2Overlap.length > 0) {
        await restPost('notifications', {
          user_id: RESELLER2.id,
          type: 'new_rfq',
          message: `New RFQ: ${plan.title.replace(SCALE_PREFIX, '')}`,
          rfq_id: plan.rfqId,
          read: Math.random() < 0.4,
        });
        stats.notifsCreated++;
      }
    }

    // Award notifications
    if (plan.status === 'awarded' && plan.r1BidId) {
      await restPost('notifications', {
        user_id: RESELLER1.id,
        type: 'bid_won',
        message: `You won: ${plan.title.replace(SCALE_PREFIX, '')}`,
        rfq_id: plan.rfqId,
        read: false,
      });
      stats.notifsCreated++;
    }
  }

  console.log('✅ Scale seeding complete\n');
  console.log('  RFQs created:                 ' + stats.rfqsCreated);
  console.log('    ├─ Sole-source:             ' + stats.soleSource);
  console.log('    ├─ Split multi-vendor:      ' + stats.splitMultiVendor);
  console.log('    └─ Filter-test (excluded):  ' + stats.filterTestRfqs);
  console.log('  Line items created:           ' + stats.itemsCreated);
  console.log('  Bids created:                 ' + stats.bidsCreated);
  console.log('  Messages created:             ' + stats.messagesCreated);
  console.log('  Notifications created:        ' + stats.notifsCreated);
  console.log('\n  All rows tagged with prefix: "' + SCALE_PREFIX + '"');
  console.log('  Cleanup: npx playwright test tests/cleanup-scale-data.spec.js\n');
});
