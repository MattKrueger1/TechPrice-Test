const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy';

// Unique emails per run so tests don't collide with previous runs
const TS = Date.now();
const BUYER_TEST_EMAIL = `playwright-buyer-${TS}@example.com`;
const RESELLER_TEST_EMAIL = `playwright-reseller-${TS}@example.com`;
const TEST_PASSWORD = 'TestPass8888';

// Dummy Word doc buffer for vendor authorization upload
const DUMMY_DOCX = Buffer.from('PK dummy docx content for playwright test');

async function deleteProfileByEmail(email) {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };
  // Delete reseller vendor rows (via reseller_profiles lookup)
  await fetch(`${SUPABASE_URL}/rest/v1/reseller_vendors?contact_email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', headers });
  // Delete reseller profile
  await fetch(`${SUPABASE_URL}/rest/v1/reseller_profiles?contact_email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', headers });
  // Delete buyer profile (auth users can't be deleted via publishable key — they accumulate; clean manually if needed)
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', headers });
  console.log('🧹 Cleaned up profile for:', email);
}

/* ══════════════════════════════════════════════════════════
   BUYER SIGNUP
══════════════════════════════════════════════════════════ */
test('Buyer signup — new account created successfully', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });

  // Switch to Create account tab
  await page.click('button:has-text("Create account")');
  await page.waitForSelector('#panel-signup.active', { timeout: 5000 });

  // Fill signup form
  await page.fill('#signup-first', 'Playwright');
  await page.fill('#signup-last', 'Buyer');
  await page.fill('#signup-company', 'Test Corp');
  await page.fill('#signup-email', BUYER_TEST_EMAIL);
  await page.fill('#signup-password', TEST_PASSWORD);

  // Submit
  await page.click('#signup-btn');

  // Success state should appear
  await expect(page.locator('#success-state')).toHaveClass(/visible/, { timeout: 15000 });
  const title = await page.locator('#success-title').textContent();
  expect(title).toContain('Account created');
  console.log('✅ Buyer signup success screen shown');
});

test('Buyer signup — shows error on duplicate email', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.click('button:has-text("Create account")');
  await page.waitForSelector('#panel-signup.active', { timeout: 5000 });

  // Use existing buyer account email (already in DB)
  await page.fill('#signup-first', 'Matt');
  await page.fill('#signup-last', 'Krueger');
  await page.fill('#signup-company', 'Test Corp');
  await page.fill('#signup-email', 'mattkrueger@comcast.net');
  await page.fill('#signup-password', TEST_PASSWORD);
  await page.click('#signup-btn');

  // Should show an auth error (email already in use)
  await expect(page.locator('#auth-error-banner')).toBeVisible({ timeout: 10000 });
  console.log('✅ Duplicate email error shown');
});

test('Buyer signup — validation blocks empty required fields', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.click('button:has-text("Create account")');
  await page.waitForSelector('#panel-signup.active', { timeout: 5000 });

  // Click submit without filling anything
  await page.click('#signup-btn');

  // Field errors should appear
  await expect(page.locator('#signup-email-error')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#signup-password-error')).toBeVisible({ timeout: 5000 });
  console.log('✅ Validation errors shown on empty submit');
});

/* ══════════════════════════════════════════════════════════
   RESELLER APPLICATION
══════════════════════════════════════════════════════════ */
test('Reseller apply — full application submitted successfully', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto(`${BASE}/bidbridge-reseller-apply_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#panel-1.active', { timeout: 10000 });

  /* ── Step 1: Company & contact info ── */
  console.log('📝 Reseller Step 1: Filling company info...');
  await page.fill('#company-name', 'Playwright Reseller Inc.');
  await page.fill('#company-website', 'https://playwright-reseller.com');
  await page.fill('#company-founded', '2020');
  await page.selectOption('#company-size', { label: '11–25 employees' });
  await page.fill('#company-city', 'Austin');
  await page.fill('#company-state', 'TX');
  await page.fill('#company-hq', 'Austin, TX');
  await page.fill('#company-desc', 'Automated test reseller — please ignore this application.');
  await page.fill('#contact-first', 'Playwright');
  await page.fill('#contact-last', 'Reseller');
  await page.fill('#contact-title', 'QA Engineer');
  await page.fill('#contact-email', RESELLER_TEST_EMAIL);
  await page.fill('#contact-phone', '(512) 555-0100');
  await page.fill('#contact-password', TEST_PASSWORD);

  // Go to Step 2
  await page.click('button:has-text("Next: Vendor authorizations")');
  await page.waitForSelector('#panel-2.active', { timeout: 10000 });
  console.log('✅ Reseller Step 1 complete');

  /* ── Step 2: Vendor authorizations ── */
  console.log('📝 Reseller Step 2: Adding vendor authorizations...');

  // First vendor (auto-added when entering step 2)
  await page.waitForSelector('#va-vendor-1', { timeout: 5000 });
  await page.selectOption('#va-vendor-1', 'Cisco');
  // Select Gold tier for vendor 1
  await page.click('#tier-opt-1-gold');
  // Upload dummy auth document for vendor 1
  await page.setInputFiles('#vendor-auth-1 input[type="file"]', {
    name: 'cisco-auth.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: DUMMY_DOCX,
  });
  console.log('✅ Vendor 1 (Cisco / Gold) added with document');

  // Add a second vendor
  await page.click('button:has-text("Add another vendor authorization")');
  await page.waitForSelector('#va-vendor-2', { timeout: 5000 });
  await page.selectOption('#va-vendor-2', 'Dell Technologies');
  // Select Silver tier for vendor 2
  await page.click('#tier-opt-2-silver');
  // Upload dummy auth document for vendor 2
  await page.setInputFiles('#vendor-auth-2 input[type="file"]', {
    name: 'dell-auth.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: DUMMY_DOCX,
  });
  console.log('✅ Vendor 2 (Dell Technologies / Silver) added with document');

  // Go to Step 3
  await page.click('button:has-text("Next: Review")');
  await page.waitForSelector('#panel-3.active', { timeout: 10000 });
  console.log('✅ Reseller Step 2 complete');

  /* ── Step 3: Terms & submit ── */
  console.log('📝 Reseller Step 3: Agreeing to terms and submitting...');
  await page.click('#check-1');
  await page.click('#check-2');
  await page.click('#check-3');

  await page.click('#submit-btn');

  // Success screen should appear
  await expect(page.locator('#success-screen')).toBeVisible({ timeout: 30000 });
  console.log('✅ Reseller application submitted — success screen shown');
  console.log('ℹ️  Account is now PENDING — admin must approve in Supabase before reseller can log in');

  // Cleanup profile rows (auth user must be deleted manually via Supabase dashboard)
  await deleteProfileByEmail(RESELLER_TEST_EMAIL);
});

test('Reseller apply — step 1 validation blocks empty required fields', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-apply_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#panel-1.active', { timeout: 10000 });

  // Try to advance without filling anything
  await page.click('button:has-text("Next: Vendor authorizations")');

  // Should stay on step 1 with errors visible
  await expect(page.locator('#company-name-error')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#panel-1')).toHaveClass(/active/);
  console.log('✅ Step 1 validation blocks empty form');
});

test('Reseller apply — step 2 blocks advance with no vendor added', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto(`${BASE}/bidbridge-reseller-apply_1.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#panel-1.active', { timeout: 10000 });

  // Fill step 1 minimally
  await page.fill('#company-name', 'Test Co');
  await page.fill('#company-website', 'https://test.com');
  await page.fill('#company-founded', '2020');
  await page.selectOption('#company-size', { label: '1–10 employees' });
  await page.fill('#company-city', 'Boston');
  await page.fill('#company-state', 'MA');
  await page.fill('#company-hq', 'Boston, MA');
  await page.fill('#contact-first', 'Test');
  await page.fill('#contact-last', 'User');
  await page.fill('#contact-title', 'Manager');
  await page.fill('#contact-email', `playwright-s2test-${TS}@example.com`);
  await page.fill('#contact-phone', '5551234567');
  await page.fill('#contact-password', TEST_PASSWORD);
  await page.click('button:has-text("Next: Vendor authorizations")');
  await page.waitForSelector('#panel-2.active', { timeout: 10000 });

  // Remove the auto-added vendor
  const removeBtn = page.locator('button:has-text("Remove")').first();
  if (await removeBtn.count() > 0) {
    await removeBtn.click();
  }

  // Try to advance with zero vendors — should get an alert
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('at least one vendor');
    dialog.dismiss();
    console.log('✅ Alert shown: at least one vendor required');
  });
  await page.click('button:has-text("Next: Review")');
});

test('Reseller apply — page loads with correct step indicator', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-reseller-apply_1.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#si-1')).toHaveClass(/active/);
  await expect(page.locator('#panel-1')).toHaveClass(/active/);
  console.log('✅ Reseller apply page loads on step 1');
});
