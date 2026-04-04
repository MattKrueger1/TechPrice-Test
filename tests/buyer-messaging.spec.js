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

test('RFQ group headers appear in messages panel (accordion)', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(3000);

  await page.locator('#nav-messages').click();
  await page.waitForTimeout(3000);

  // Accordion: group headers should be visible, not filter pills
  const groupHeaders = page.locator('#msg-inbox-threads .msg-rfq-group-header');
  const count = await groupHeaders.count();

  if (count === 0) {
    const emptyMsg = await page.locator('#msg-inbox-threads').textContent();
    console.log('No groups yet:', emptyMsg.slice(0, 80));
    return;
  }

  await expect(groupHeaders.first()).toBeVisible();
  const headerText = await groupHeaders.first().textContent();
  // Should show "N resellers" sub-label
  expect(headerText).toMatch(/reseller/i);
  console.log('✅ RFQ group header:', headerText.trim().slice(0, 60));
});

test('Clicking an RFQ group header expands reseller threads', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(4000);

  await page.locator('#nav-messages').click();
  await page.waitForTimeout(3000);

  const firstGroupHeader = page.locator('#msg-inbox-threads .msg-rfq-group-header').first();
  const hasGroups = await firstGroupHeader.count() > 0;

  if (!hasGroups) {
    console.log('No RFQ groups — buyer account has no messages yet');
    return;
  }

  // Before clicking, reseller rows should be hidden (collapsed)
  await firstGroupHeader.click();
  await page.waitForTimeout(500);

  // After clicking, the reseller list inside should be open
  const openList = page.locator('#msg-inbox-threads .msg-reseller-list.open').first();
  await expect(openList).toBeVisible({ timeout: 5000 });

  const resellerRows = openList.locator('.msg-thread-item');
  const rowCount = await resellerRows.count();
  expect(rowCount).toBeGreaterThan(0);
  console.log('✅ Expanded group shows', rowCount, 'reseller thread(s)');
});

test('Clicking a reseller thread opens a conversation', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(4000);

  await page.locator('#nav-messages').click();
  await page.waitForTimeout(3000);

  const firstGroupHeader = page.locator('#msg-inbox-threads .msg-rfq-group-header').first();
  if (await firstGroupHeader.count() === 0) {
    console.log('No groups — skipping conversation test');
    return;
  }

  // Expand the first group
  await firstGroupHeader.click();
  await page.waitForTimeout(500);

  // Click first reseller thread
  const firstThread = page.locator('#msg-inbox-threads .msg-reseller-list.open .msg-thread-item').first();
  await expect(firstThread).toBeVisible({ timeout: 5000 });
  await firstThread.click();
  await page.waitForTimeout(2000);

  // Conversation header should appear
  await expect(page.locator('#msg-inbox-conv .msg-conv-header')).toBeVisible({ timeout: 8000 });
  console.log('✅ Conversation opened successfully');
});

test('Send button present when a direct reseller thread is selected', async ({ page }) => {
  await page.goto(`${BASE}/bidbridge-buyer-dashboard_2.html`);
  await page.waitForTimeout(4000);

  await page.locator('#nav-messages').click();
  await page.waitForTimeout(3000);

  const firstGroupHeader = page.locator('#msg-inbox-threads .msg-rfq-group-header').first();
  if (await firstGroupHeader.count() === 0) {
    console.log('No groups — skipping send button check');
    return;
  }

  await firstGroupHeader.click();
  await page.waitForTimeout(500);

  // Find a non-broadcast thread
  const threads = page.locator('#msg-inbox-threads .msg-reseller-list.open .msg-thread-item');
  const count = await threads.count();
  if (count === 0) { console.log('No reseller threads visible'); return; }

  await threads.first().click();
  await page.waitForTimeout(2000);

  const convHtml = await page.locator('#msg-inbox-conv').innerHTML();
  if (convHtml.includes('Broadcast (all bidders)') && !convHtml.includes('msg-inbox-input')) {
    console.log('First thread is broadcast-only — no compose area expected');
  } else {
    await expect(page.locator('#msg-inbox-conv .btn-send')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#msg-inbox-input')).toBeVisible();
    console.log('✅ Send button and textarea visible for direct thread');
  }
});
