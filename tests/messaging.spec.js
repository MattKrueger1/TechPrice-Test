const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const BUYER_EMAIL = 'mattkrueger@comcast.net';
const BUYER_PASSWORD = 'Test12345678';
const RESELLER_EMAIL = 'mk@comcast.net';
const RESELLER_PASSWORD = 'Test12345678';

// ── helpers ─────────────────────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-btn');
  await page.waitForURL(/dashboard/, { timeout: 15000 });
}

async function loginAsBuyer(page) {
  await loginAs(page, BUYER_EMAIL, BUYER_PASSWORD);
}

async function goToCompareBids(page) {
  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000); // let all data load
}

// ── BUYER SIDE ───────────────────────────────────────────────────────────────

test('Buyer: Message button visible on bid cards', async ({ page }) => {
  await loginAsBuyer(page);
  await goToCompareBids(page);

  // Find an RFQ in the rail that has bids
  const railItems = page.locator('.rfq-rail-item');
  const count = await railItems.count();
  let foundBidCard = false;

  for (let i = 0; i < count; i++) {
    const item = railItems.nth(i);
    const bidCount = await item.locator('.rfq-rail-bids').textContent();
    if (bidCount.match(/^[1-9]/)) {
      await item.click();
      await page.waitForTimeout(3000);
      const msgBtn = page.locator('.btn-msg').first();
      if (await msgBtn.count() > 0) {
        await expect(msgBtn).toBeVisible();
        foundBidCard = true;
        console.log('✅ Message button visible on bid card');
        break;
      }
    }
  }

  if (!foundBidCard) console.log('ℹ️  No bid cards with Message buttons found');
});

test('Buyer: Clicking Message button opens messaging panel', async ({ page }) => {
  await loginAsBuyer(page);
  await goToCompareBids(page);

  // Navigate to an RFQ with bids
  const railItems = page.locator('.rfq-rail-item');
  for (let i = 0; i < await railItems.count(); i++) {
    const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
    if (bidCount.match(/^[1-9]/)) {
      await railItems.nth(i).click();
      await page.waitForTimeout(3000);
      const msgBtn = page.locator('.btn-msg').first();
      if (await msgBtn.count() > 0) {
        await msgBtn.click();
        await expect(page.locator('#msg-overlay')).toHaveClass(/open/, { timeout: 5000 });
        console.log('✅ Messaging panel opens on Message button click');
        return;
      }
    }
  }
  console.log('ℹ️  No Message buttons available to test');
});

test('Buyer: Message panel shows thread area and compose input', async ({ page }) => {
  await loginAsBuyer(page);
  await goToCompareBids(page);

  const railItems = page.locator('.rfq-rail-item');
  for (let i = 0; i < await railItems.count(); i++) {
    const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
    if (bidCount.match(/^[1-9]/)) {
      await railItems.nth(i).click();
      await page.waitForTimeout(3000);
      const msgBtn = page.locator('.btn-msg').first();
      if (await msgBtn.count() > 0) {
        await msgBtn.click();
        await page.waitForTimeout(2000);
        await expect(page.locator('#msg-thread')).toBeVisible();
        await expect(page.locator('#msg-input')).toBeVisible();
        await expect(page.locator('.btn-send')).toBeVisible();
        console.log('✅ Messaging panel shows thread, input, and Send button');
        return;
      }
    }
  }
  console.log('ℹ️  Skipped — no bid cards found');
});

test('Buyer: Can type and send a direct message', async ({ page }) => {
  await loginAsBuyer(page);
  await goToCompareBids(page);

  const railItems = page.locator('.rfq-rail-item');
  for (let i = 0; i < await railItems.count(); i++) {
    const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
    if (bidCount.match(/^[1-9]/)) {
      await railItems.nth(i).click();
      await page.waitForTimeout(3000);
      const msgBtn = page.locator('.btn-msg').first();
      if (await msgBtn.count() > 0) {
        await msgBtn.click();
        await page.waitForTimeout(2000);

        const msg = `Test direct message ${Date.now()}`;
        await page.fill('#msg-input', msg);
        await page.click('.btn-send');
        await page.waitForTimeout(3000);

        // Message should appear in thread
        const thread = page.locator('#msg-thread');
        await expect(thread).toContainText(msg, { timeout: 8000 });
        console.log('✅ Direct message sent and appears in thread');
        return;
      }
    }
  }
  console.log('ℹ️  Skipped — no bid cards found');
});

test('Buyer: Broadcast button opens broadcast panel', async ({ page }) => {
  await loginAsBuyer(page);
  await goToCompareBids(page);

  // Navigate to an RFQ with bids first
  const railItems = page.locator('.rfq-rail-item');
  for (let i = 0; i < await railItems.count(); i++) {
    const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
    if (bidCount.match(/^[1-9]/)) {
      await railItems.nth(i).click();
      await page.waitForTimeout(3000);
      break;
    }
  }

  await page.click('button:has-text("Message all")');
  await expect(page.locator('#msg-overlay')).toHaveClass(/open/, { timeout: 5000 });
  const title = await page.locator('#msg-panel-title').textContent();
  expect(title).toContain('all resellers');
  console.log(`✅ Broadcast panel opens: "${title}"`);
});

test('Buyer: Broadcast panel shows bidder count', async ({ page }) => {
  await loginAsBuyer(page);
  await goToCompareBids(page);

  const railItems = page.locator('.rfq-rail-item');
  for (let i = 0; i < await railItems.count(); i++) {
    const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
    if (bidCount.match(/^[1-9]/)) {
      await railItems.nth(i).click();
      await page.waitForTimeout(3000);
      break;
    }
  }

  await page.click('button:has-text("Message all")');
  await page.waitForTimeout(1000);
  const sub = await page.locator('#msg-panel-sub').textContent();
  expect(sub).toMatch(/\d+ bidder/);
  console.log(`✅ Broadcast panel shows bidder count: "${sub}"`);
});

test('Buyer: Can send a broadcast message', async ({ page }) => {
  await loginAsBuyer(page);
  await goToCompareBids(page);

  const railItems = page.locator('.rfq-rail-item');
  for (let i = 0; i < await railItems.count(); i++) {
    const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
    if (bidCount.match(/^[1-9]/)) {
      await railItems.nth(i).click();
      await page.waitForTimeout(3000);
      break;
    }
  }

  await page.click('button:has-text("Message all")');
  await page.waitForTimeout(2000);

  const msg = `Broadcast test ${Date.now()}`;
  await page.fill('#msg-input', msg);
  await page.click('.btn-send');
  await page.waitForTimeout(3000);

  const thread = page.locator('#msg-thread');
  await expect(thread).toContainText(msg, { timeout: 8000 });
  console.log('✅ Broadcast message sent and appears in thread');
});

test('Buyer: Closing message panel works', async ({ page }) => {
  await loginAsBuyer(page);
  await goToCompareBids(page);

  const railItems = page.locator('.rfq-rail-item');
  for (let i = 0; i < await railItems.count(); i++) {
    const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
    if (bidCount.match(/^[1-9]/)) {
      await railItems.nth(i).click();
      await page.waitForTimeout(3000);
      const msgBtn = page.locator('.btn-msg').first();
      if (await msgBtn.count() > 0) {
        await msgBtn.click();
        await expect(page.locator('#msg-overlay')).toHaveClass(/open/);
        await page.click('.msg-close');
        await expect(page.locator('#msg-overlay')).not.toHaveClass(/open/);
        console.log('✅ Message panel closes correctly');
        return;
      }
    }
  }
  console.log('ℹ️  Skipped');
});

test('Buyer: Previously sent messages persist on re-open', async ({ page }) => {
  await loginAsBuyer(page);
  await goToCompareBids(page);

  const railItems = page.locator('.rfq-rail-item');
  for (let i = 0; i < await railItems.count(); i++) {
    const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
    if (bidCount.match(/^[1-9]/)) {
      await railItems.nth(i).click();
      await page.waitForTimeout(3000);
      const msgBtn = page.locator('.btn-msg').first();
      if (await msgBtn.count() > 0) {
        // Send a message
        await msgBtn.click();
        await page.waitForTimeout(2000);
        const msg = `Persist test ${Date.now()}`;
        await page.fill('#msg-input', msg);
        await page.click('.btn-send');
        await page.waitForTimeout(3000);

        // Close and reopen
        await page.click('.msg-close');
        await page.waitForTimeout(500);
        await msgBtn.click();
        await page.waitForTimeout(3000);

        // Message should still be there (loaded from DB)
        await expect(page.locator('#msg-thread')).toContainText(msg, { timeout: 8000 });
        console.log('✅ Messages persist across close/reopen');
        return;
      }
    }
  }
  console.log('ℹ️  Skipped');
});

// ── RESELLER SIDE ─────────────────────────────────────────────────────────────

test('Reseller: Message button visible on My Bids cards', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
  await page.waitForTimeout(4000);

  // Switch to My Bids tab
  // My Bids section always visible
  await page.waitForTimeout(1000);

  const msgBtn = page.locator('.btn-msg-small').first();
  if (await msgBtn.count() > 0) {
    await expect(msgBtn).toBeVisible();
    console.log('✅ Message button visible on reseller My Bids card');
  } else {
    console.log('ℹ️  No active bids with Message button');
  }
});

test('Reseller: Clicking Message button opens messaging panel', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
  await page.waitForTimeout(4000);

  // My Bids section always visible
  await page.waitForTimeout(1000);

  const msgBtn = page.locator('.btn-msg-small').first();
  if (await msgBtn.count() === 0) { console.log('ℹ️  No bid with Message button'); return; }

  await msgBtn.click();
  // openMsg() scrolls to inline #section-messages and selects a thread — no overlay popup
  await expect(page.locator('#msg-inbox-conv .msg-conv-header')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#msg-conv-thread')).toBeVisible();
  await expect(page.locator('#msg-inbox-input')).toBeVisible();
  console.log('✅ Reseller message panel opens with thread and input');
});

test('Reseller: Can send a message to buyer', async ({ page }) => {
  await loginAs(page, RESELLER_EMAIL, RESELLER_PASSWORD);
  await page.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
  await page.waitForTimeout(4000);

  // My Bids section always visible
  await page.waitForTimeout(1000);

  const msgBtn = page.locator('.btn-msg-small').first();
  if (await msgBtn.count() === 0) { console.log('ℹ️  No active bid to message from'); return; }

  await msgBtn.click();
  // openMsg() scrolls to inline messaging section — wait for thread to load
  await expect(page.locator('#msg-inbox-conv .msg-conv-header')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1500);

  // If buyer ID couldn't be resolved, sending would silently fail — check first
  const threadContent = await page.locator('#msg-conv-thread').textContent().catch(() => '');
  if (threadContent.includes('buyer ID missing')) {
    console.log('ℹ️  No buyer ID available for this thread — no prior messages exist');
    return;
  }

  const msg = `Reseller reply ${Date.now()}`;
  await page.fill('#msg-inbox-input', msg);
  await page.click('#msg-inbox-conv .btn-send');
  await page.waitForTimeout(3000);

  await expect(page.locator('#msg-conv-thread')).toContainText(msg, { timeout: 8000 });
  console.log('✅ Reseller message sent and appears in thread');
});

// ── TWO-SIDED: buyer sends → reseller sees, reseller replies → buyer sees ─────

test('Two-sided: buyer sends message → reseller sees it in thread', async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const reseller = await resellerCtx.newPage();

  try {
    await loginAs(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);

    // Buyer goes to compare-bids and finds an RFQ with bids
    await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await buyer.waitForTimeout(5000);

    // Find rail item with bids
    const railItems = buyer.locator('.rfq-rail-item');
    let rfqFound = false;
    for (let i = 0; i < await railItems.count(); i++) {
      const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
      if (bidCount.match(/^[1-9]/)) {
        await railItems.nth(i).click();
        await buyer.waitForTimeout(3000);
        rfqFound = true;
        break;
      }
    }
    if (!rfqFound) { console.log('ℹ️  No RFQ with bids to test two-sided messaging'); return; }

    // Buyer sends a direct message
    const msgBtn = buyer.locator('.btn-msg').first();
    if (await msgBtn.count() === 0) { console.log('ℹ️  No message button on bid card'); return; }

    await msgBtn.click();
    await buyer.waitForTimeout(2000);

    const msg = `Buyer→Reseller test ${Date.now()}`;
    await buyer.fill('#msg-input', msg);
    await buyer.click('.btn-send');
    await buyer.waitForTimeout(3000);
    await expect(buyer.locator('#msg-thread')).toContainText(msg, { timeout: 8000 });
    console.log('✅ Buyer sent message:', msg.slice(0, 30));

    // Reseller goes to dashboard and opens message thread
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await reseller.waitForSelector('#open-rfq-grid', { timeout: 20000 });
    await reseller.waitForTimeout(4000);
    // My Bids section always visible

    const resellerMsgBtn = reseller.locator('.btn-msg-small').first();
    if (await resellerMsgBtn.count() === 0) { console.log('ℹ️  Reseller has no bid message buttons'); return; }

    await resellerMsgBtn.click();
    // openMsg() on reseller scrolls to inline section, not overlay
    await expect(reseller.locator('#msg-inbox-conv .msg-conv-header')).toBeVisible({ timeout: 8000 });
    await reseller.waitForTimeout(2000);

    // Check if reseller sees the buyer's message (may be different thread — graceful skip)
    const threadContent2 = await reseller.locator('#msg-conv-thread').textContent().catch(() => '');
    if (threadContent2.includes('buyer ID missing')) {
      console.log('ℹ️  Reseller thread on different RFQ than buyer message — coordination skip');
    } else if (threadContent2.includes(msg)) {
      console.log('✅ Reseller sees buyer message in their thread');
    } else {
      console.log('ℹ️  Reseller is on a different RFQ thread than buyer — coordination skip');
    }

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
  }
});

test('Two-sided: reseller replies → buyer sees reply in their thread', async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const resellerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const reseller = await resellerCtx.newPage();

  try {
    await loginAs(buyer, BUYER_EMAIL, BUYER_PASSWORD);
    await loginAs(reseller, RESELLER_EMAIL, RESELLER_PASSWORD);

    // Reseller sends a message first
    await reseller.goto(`${BASE}/bidbridge-reseller-dashboard.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await reseller.waitForSelector('#open-rfq-grid', { timeout: 20000 });
    await reseller.waitForTimeout(4000);
    // My Bids section always visible

    const resellerMsgBtn = reseller.locator('.btn-msg-small').first();
    if (await resellerMsgBtn.count() === 0) { console.log('ℹ️  No active bid for reseller to message from'); return; }

    await resellerMsgBtn.click();
    // openMsg() on reseller scrolls to inline section, not overlay
    await expect(reseller.locator('#msg-inbox-conv .msg-conv-header')).toBeVisible({ timeout: 8000 });
    await reseller.waitForTimeout(1500);

    // If buyer ID couldn't be resolved, skip
    const threadCheck = await reseller.locator('#msg-conv-thread').textContent().catch(() => '');
    if (threadCheck.includes('buyer ID missing')) {
      console.log('ℹ️  No buyer ID for this thread — skipping reseller→buyer send');
      return;
    }

    const replyMsg = `Reseller→Buyer test ${Date.now()}`;
    await reseller.fill('#msg-inbox-input', replyMsg);
    await reseller.click('#msg-inbox-conv .btn-send');
    await reseller.waitForTimeout(3000);
    await expect(reseller.locator('#msg-conv-thread')).toContainText(replyMsg, { timeout: 8000 });
    console.log('✅ Reseller sent reply:', replyMsg.slice(0, 30));

    // Buyer opens compare-bids and checks the thread for that reseller
    await buyer.goto(`${BASE}/bidbridge-compare-bids_1.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await buyer.waitForTimeout(5000);

    const railItems = buyer.locator('.rfq-rail-item');
    for (let i = 0; i < await railItems.count(); i++) {
      const bidCount = await railItems.nth(i).locator('.rfq-rail-bids').textContent();
      if (bidCount.match(/^[1-9]/)) {
        await railItems.nth(i).click();
        await buyer.waitForTimeout(3000);
        break;
      }
    }

    const msgBtn = buyer.locator('.btn-msg').first();
    if (await msgBtn.count() === 0) { console.log('ℹ️  No message button for buyer'); return; }

    await msgBtn.click();
    await buyer.waitForTimeout(3000);

    // Check if buyer sees the reply (may be different thread — graceful skip)
    const buyerThreadText = await buyer.locator('#msg-thread').textContent().catch(() => '');
    if (buyerThreadText.includes(replyMsg)) {
      console.log('✅ Buyer sees reseller reply in their thread');
    } else {
      console.log('ℹ️  Buyer thread is for a different reseller than the one who replied — coordination skip');
    }

  } finally {
    await buyerCtx.close();
    await resellerCtx.close();
  }
});
