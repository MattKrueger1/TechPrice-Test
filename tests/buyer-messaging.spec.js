const { test, expect } = require('@playwright/test');

test.use({ storageState: 'auth.json' });

const BASE = 'http://localhost:3000';

test('Messages nav item appears in buyer sidebar', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await expect(page.locator('#nav-messages')).toBeVisible({ timeout: 10000 });
  const text = await page.locator('#nav-messages').textContent();
  expect(text).toContain('Messages');
});

test('Clicking Messages nav opens messages panel', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(3000); // let init complete

  await page.locator('#nav-messages').click();
  await expect(page.locator('#panel-messages')).toHaveClass(/active/, { timeout: 5000 });
  await expect(page.locator('#msg-inbox-threads')).toBeVisible();
  await expect(page.locator('#msg-inbox-conv')).toBeVisible();
});

test('Messages panel loads thread list without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(4000);

  await page.locator('#nav-messages').click();
  await page.waitForTimeout(3000); // let loadBuyerMsgThreads complete

  expect(errors).toHaveLength(0);

  // Thread list should have rendered (either threads or empty state)
  const threadContent = await page.locator('#msg-inbox-threads').textContent();
  expect(threadContent.trim().length).toBeGreaterThan(0);

  console.log('Thread list content:', threadContent.slice(0, 100));
});

test('RFQ filter pills render in messages panel', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(3000);

  await page.locator('#nav-messages').click();
  await page.waitForTimeout(3000);

  // "All RFQs" pill must always be there
  const filterRow = page.locator('#msg-rfq-filter-row');
  await expect(filterRow).toBeVisible();
  const allPill = filterRow.locator('.filter-pill').first();
  await expect(allPill).toContainText('All RFQs');
});

test('Clicking a thread opens a conversation', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(4000);

  await page.locator('#nav-messages').click();
  await page.waitForTimeout(3000);

  const firstThread = page.locator('#msg-inbox-threads .msg-thread-item').first();
  const hasThreads = await firstThread.count() > 0;

  if (!hasThreads) {
    console.log('No message threads found — buyer account has no messages yet');
    return;
  }

  await firstThread.click();
  await page.waitForTimeout(2000);

  // Conversation pane should show the conv header
  await expect(page.locator('#msg-inbox-conv .msg-conv-header')).toBeVisible({ timeout: 8000 });
  console.log('✅ Conversation opened successfully');
});

test('Send button present when a direct thread is selected', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(4000);

  await page.locator('#nav-messages').click();
  await page.waitForTimeout(3000);

  // Find a non-broadcast thread (broadcast threads have no compose area)
  const threads = page.locator('#msg-inbox-threads .msg-thread-item');
  const count = await threads.count();

  if (count === 0) {
    console.log('No threads — skipping send button check');
    return;
  }

  await threads.first().click();
  await page.waitForTimeout(2000);

  // If it's a direct thread (not broadcast), compose area should appear
  const convHtml = await page.locator('#msg-inbox-conv').innerHTML();
  if (convHtml.includes('broadcast')) {
    console.log('First thread is broadcast — no compose area expected');
  } else {
    await expect(page.locator('#msg-inbox-conv .btn-send')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#msg-inbox-input')).toBeVisible();
    console.log('✅ Send button and textarea visible for direct thread');
  }
});
