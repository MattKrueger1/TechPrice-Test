const { test } = require('@playwright/test');
test.use({ storageState: 'auth.json' });

test('List all profiles', async ({ page }) => {
  await page.goto('http://localhost:3000/bidbridge-my-rfqs.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const result = await page.evaluate(async () => {
    const sb = window._supabase;
    const [{ data: buyers }, { data: resellers }] = await Promise.all([
      sb.from('profiles').select('id, first_name, last_name, company, email').order('created_at'),
      sb.from('reseller_profiles').select('id, contact_first, contact_last, company, contact_email').order('created_at'),
    ]);
    return { buyers: buyers || [], resellers: resellers || [] };
  });

  console.log('\n── Buyer profiles (' + result.buyers.length + ') ──────────────────');
  result.buyers.forEach(b => console.log(`  [${b.id.slice(0,8)}] ${b.first_name} ${b.last_name} | ${b.company} | ${b.email || '—'}`));
  console.log('\n── Reseller profiles (' + result.resellers.length + ') ────────────────');
  result.resellers.forEach(r => console.log(`  [${r.id.slice(0,8)}] ${r.contact_first} ${r.contact_last} | ${r.company} | ${r.contact_email || '—'}`));
});
