/**
 * AI UX INSPECTOR
 *
 * Walks through every key screen on the buyer and reseller sides,
 * takes a screenshot at each step, and asks Claude to evaluate it
 * from the perspective of a real first-time user.
 *
 * Produces: ux-report/ux-report.html (open in browser after run)
 *
 * Requires: ANTHROPIC_API_KEY in environment
 *   export ANTHROPIC_API_KEY=sk-ant-...
 */

const { test } = require('@playwright/test');
const Anthropic = require('@anthropic-ai/sdk');
const fs        = require('fs');
const path      = require('path');

const BASE         = 'http://localhost:3000';
const SUPABASE_URL = 'https://kgejpzjoiewrgwzixcaa.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';
const BUYER        = { email: 'mattkrueger@comcast.net', password: 'Test12345678' };
const RESELLER1    = { email: 'mk@comcast.net',          password: 'Test12345678' };

const REPORT_DIR = path.join(__dirname, '../ux-report');
const SHOTS_DIR  = path.join(REPORT_DIR, 'screenshots');

let anthropic;
const findings = [];

test.setTimeout(600000); // 10 min

// ─── helpers ────────────────────────────────────────────────────────────────

function ensureDirs() {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  if (!fs.existsSync(SHOTS_DIR))  fs.mkdirSync(SHOTS_DIR,  { recursive: true });
}

async function signIn(page, email, password, urlPattern) {
  await page.goto(`${BASE}/bidbridge-auth_1.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.locator('#login-form').evaluate(f => f.requestSubmit());
  await page.waitForURL(urlPattern, { timeout: 20000 });
  await page.waitForTimeout(2500);
}

async function captureAndAnalyze(page, label, persona, context) {
  const slug    = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const shotPath = path.join(SHOTS_DIR, `${slug}.png`);

  // Take full-page screenshot
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shotPath, fullPage: false });

  // Get visible text for context
  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  const pageUrl  = page.url();

  console.log(`  📸 Analyzing: ${label}...`);

  let score = null;
  let feedback = 'API key not configured — skipping AI analysis';
  let suggestions = [];

  if (anthropic) {
    try {
      const imageData = fs.readFileSync(shotPath).toString('base64');

      const prompt = `You are a UX expert reviewing a B2B IT procurement marketplace called IT Pricing Network.

SCREEN: "${label}"
URL: ${pageUrl}
PERSONA: ${persona}
CONTEXT: ${context}

PAGE TEXT EXCERPT:
${pageText}

Evaluate this screen from the perspective of the persona described above who is using this platform for the FIRST TIME.

Respond in this exact JSON format:
{
  "score": <1-10 integer>,
  "headline": "<one sentence summary of UX quality>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "issues": ["<issue 1>", "<issue 2>"],
  "suggestions": ["<suggestion 1>", "<suggestion 2>"],
  "first_impression": "<what would a first-time user think in 2 seconds>",
  "next_action_clear": <true|false>,
  "confusion_risk": "<low|medium|high>"
}

Be specific, honest, and actionable. Score 1-4 = poor, 5-6 = needs work, 7-8 = good, 9-10 = excellent.`;

      const response = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData } },
            { type: 'text', text: prompt },
          ],
        }],
      });

      const raw = response.content[0].text;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score       = parsed.score;
        feedback    = parsed.headline;
        suggestions = [...(parsed.issues || []), ...(parsed.suggestions || [])];
        findings.push({ label, slug, score, persona, parsed, url: pageUrl });
      }
    } catch (err) {
      console.log(`  ⚠️  AI analysis failed for "${label}": ${err.message}`);
      findings.push({ label, slug, score: null, persona, parsed: null, url: pageUrl, error: err.message });
    }
  } else {
    findings.push({ label, slug, score: null, persona, parsed: null, url: pageUrl, error: 'No API key' });
  }

  const scoreStr = score !== null ? `${score}/10` : '?/10';
  console.log(`  ${getScoreEmoji(score)} ${label}: ${scoreStr} — ${feedback}`);
  return score;
}

function getScoreEmoji(score) {
  if (score === null) return '⬜';
  if (score >= 9) return '🟢';
  if (score >= 7) return '🟡';
  if (score >= 5) return '🟠';
  return '🔴';
}

function generateHTMLReport() {
  const avgScore = findings.filter(f => f.score !== null).reduce((s, f) => s + f.score, 0)
    / (findings.filter(f => f.score !== null).length || 1);

  const rows = findings.map(f => {
    const p = f.parsed;
    const scoreColor = f.score >= 8 ? '#059669' : f.score >= 6 ? '#D97706' : f.score >= 4 ? '#EA580C' : '#DC2626';
    return `
    <div class="finding" id="${f.slug}">
      <div class="finding-header">
        <span class="score" style="background:${scoreColor}">${f.score !== null ? f.score + '/10' : '?'}</span>
        <div class="finding-title">
          <h3>${f.label}</h3>
          <span class="persona-tag">${f.persona}</span>
        </div>
      </div>
      ${p ? `
      <p class="headline">${p.headline}</p>
      <div class="meta-row">
        <span class="meta-item ${p.next_action_clear ? 'good' : 'bad'}">Next action ${p.next_action_clear ? '✓ clear' : '✗ unclear'}</span>
        <span class="meta-item risk-${p.confusion_risk}">Confusion risk: ${p.confusion_risk}</span>
        <span class="meta-item">First impression: "${p.first_impression}"</span>
      </div>
      <div class="two-col">
        ${p.strengths?.length ? `<div class="col"><h4>✓ Strengths</h4><ul>${p.strengths.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}
        ${p.issues?.length ? `<div class="col"><h4>⚠ Issues</h4><ul class="issues">${p.issues.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}
      </div>
      ${p.suggestions?.length ? `<div class="suggestions"><h4>💡 Suggestions</h4><ul>${p.suggestions.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}
      ` : `<p class="error">Analysis unavailable: ${f.error || 'unknown error'}</p>`}
      <a class="screenshot-link" href="screenshots/${f.slug}.png" target="_blank">View screenshot →</a>
    </div>`;
  }).join('\n');

  const byPersona = {};
  findings.forEach(f => {
    if (!byPersona[f.persona]) byPersona[f.persona] = [];
    byPersona[f.persona].push(f);
  });

  const criticalIssues = findings.filter(f => f.score !== null && f.score < 6);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IT Pricing Network — UX Inspection Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8F9FA; color: #111; font-size: 15px; line-height: 1.6; }
  .header { background: #1E2337; color: #fff; padding: 40px 48px; }
  .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
  .header p { color: #94A3B8; font-size: 14px; }
  .summary { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; padding: 32px 48px; background: #fff; border-bottom: 1px solid #E5E7EB; }
  .summary-card { background: #F8F9FA; border: 1px solid #E5E7EB; border-radius: 10px; padding: 20px; }
  .summary-card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin-bottom: 6px; }
  .summary-card .value { font-size: 32px; font-weight: 700; color: #111; }
  .summary-card .sub { font-size: 12px; color: #6B7280; margin-top: 4px; }
  .critical { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 10px; padding: 20px 48px; margin: 0 0 0 0; }
  .critical h2 { color: #DC2626; font-size: 16px; margin-bottom: 12px; }
  .critical ul { margin-left: 20px; }
  .critical li { color: #991B1B; font-size: 14px; margin-bottom: 4px; }
  .container { max-width: 1000px; margin: 0 auto; padding: 40px 48px; }
  .section-title { font-size: 20px; font-weight: 700; margin: 32px 0 16px; color: #111; padding-bottom: 10px; border-bottom: 2px solid #E5E7EB; }
  .finding { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
  .finding-header { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
  .score { font-size: 20px; font-weight: 800; color: #fff; padding: 6px 14px; border-radius: 8px; white-space: nowrap; }
  .finding-title h3 { font-size: 16px; font-weight: 600; }
  .persona-tag { font-size: 11px; background: #EFF6FF; color: #1D4ED8; padding: 2px 8px; border-radius: 999px; font-weight: 500; }
  .headline { color: #374151; font-size: 14px; margin-bottom: 12px; }
  .meta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .meta-item { font-size: 12px; background: #F3F4F6; padding: 3px 10px; border-radius: 6px; color: #374151; }
  .meta-item.good { background: #ECFDF5; color: #059669; }
  .meta-item.bad  { background: #FEF2F2; color: #DC2626; }
  .meta-item.risk-high   { background: #FEF2F2; color: #DC2626; }
  .meta-item.risk-medium { background: #FFFBEB; color: #D97706; }
  .meta-item.risk-low    { background: #ECFDF5; color: #059669; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
  .col h4 { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #374151; }
  .col ul { margin-left: 16px; }
  .col li { font-size: 13px; color: #4B5563; margin-bottom: 4px; }
  ul.issues li { color: #B45309; }
  .suggestions { background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; padding: 14px 18px; }
  .suggestions h4 { font-size: 13px; font-weight: 600; color: #0369A1; margin-bottom: 8px; }
  .suggestions li { font-size: 13px; color: #0369A1; margin-left: 16px; margin-bottom: 4px; }
  .screenshot-link { display: inline-block; margin-top: 12px; font-size: 12px; color: #6366F1; text-decoration: none; }
  .screenshot-link:hover { text-decoration: underline; }
  .error { color: #9CA3AF; font-size: 13px; font-style: italic; margin: 8px 0; }
  .footer { text-align: center; padding: 40px; color: #9CA3AF; font-size: 13px; }
</style>
</head>
<body>
<div class="header">
  <h1>UX Inspection Report</h1>
  <p>IT Pricing Network — Generated ${new Date().toLocaleString()} · ${findings.length} screens analyzed</p>
</div>

<div class="summary">
  <div class="summary-card">
    <div class="label">Overall Score</div>
    <div class="value">${avgScore.toFixed(1)}<span style="font-size:18px;color:#9CA3AF">/10</span></div>
    <div class="sub">Avg across all screens</div>
  </div>
  <div class="summary-card">
    <div class="label">Screens Analyzed</div>
    <div class="value">${findings.length}</div>
    <div class="sub">Both buyer & reseller</div>
  </div>
  <div class="summary-card">
    <div class="label">Needs Attention</div>
    <div class="value" style="color:#DC2626">${criticalIssues.length}</div>
    <div class="sub">Score below 6/10</div>
  </div>
  <div class="summary-card">
    <div class="label">High Performing</div>
    <div class="value" style="color:#059669">${findings.filter(f => f.score >= 8).length}</div>
    <div class="sub">Score 8 or above</div>
  </div>
</div>

${criticalIssues.length > 0 ? `
<div style="padding: 0 48px;">
<div class="critical">
  <h2>⚠️ Screens Needing Immediate Attention (score &lt; 6)</h2>
  <ul>
    ${criticalIssues.map(f => `<li><strong>${f.label}</strong> (${f.score}/10) — ${f.parsed?.headline || 'see details below'}</li>`).join('\n    ')}
  </ul>
</div>
</div>` : ''}

<div class="container">

${Object.entries(byPersona).map(([persona, items]) => `
  <div class="section-title">${persona}</div>
  ${items.map(f => findings.find(x => x.label === f.label && x.persona === f.persona)).filter(Boolean).map(f => {
    const p = f.parsed;
    const scoreColor = !f.score ? '#9CA3AF' : f.score >= 8 ? '#059669' : f.score >= 6 ? '#D97706' : f.score >= 4 ? '#EA580C' : '#DC2626';
    return `
    <div class="finding" id="${f.slug}">
      <div class="finding-header">
        <span class="score" style="background:${scoreColor}">${f.score !== null ? f.score + '/10' : '?'}</span>
        <div class="finding-title">
          <h3>${f.label}</h3>
          <span class="persona-tag">${f.persona}</span>
        </div>
      </div>
      ${p ? `
      <p class="headline">${p.headline}</p>
      <div class="meta-row">
        <span class="meta-item ${p.next_action_clear ? 'good' : 'bad'}">Next action ${p.next_action_clear ? '✓ clear' : '✗ unclear'}</span>
        <span class="meta-item risk-${p.confusion_risk}">Confusion risk: ${p.confusion_risk}</span>
      </div>
      <p style="font-size:13px;color:#6B7280;margin-bottom:14px;font-style:italic;">"${p.first_impression}"</p>
      <div class="two-col">
        ${p.strengths?.length ? `<div class="col"><h4>✓ Strengths</h4><ul>${p.strengths.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}
        ${p.issues?.length ? `<div class="col"><h4>⚠ Issues</h4><ul class="issues">${p.issues.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}
      </div>
      ${p.suggestions?.length ? `<div class="suggestions"><h4>💡 Suggestions</h4><ul>${p.suggestions.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}
      ` : `<p class="error">Analysis unavailable: ${f.error || 'unknown error'}</p>`}
      <a class="screenshot-link" href="screenshots/${f.slug}.png" target="_blank">View screenshot →</a>
    </div>`;
  }).join('\n')}
`).join('\n')}

</div>
<div class="footer">IT Pricing Network UX Inspection Report · Powered by Claude AI</div>
</body>
</html>`;

  fs.writeFileSync(path.join(REPORT_DIR, 'ux-report.html'), html);
  console.log(`\n📊 UX Report written to: ux-report/ux-report.html`);
  console.log(`   Overall score: ${avgScore.toFixed(1)}/10`);
  console.log(`   Screens needing work: ${criticalIssues.length}`);
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN TEST — walks every key screen
// ════════════════════════════════════════════════════════════════════════════

test('AI UX Inspector — full site walkthrough', async ({ page }) => {
  ensureDirs();

  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    anthropic = new Anthropic({ apiKey });
    console.log('  ✓ Anthropic API connected');
  } else {
    console.log('  ⚠️  ANTHROPIC_API_KEY not set — screenshots will be taken but AI analysis skipped');
    console.log('     Run with: ANTHROPIC_API_KEY=sk-ant-... npx playwright test tests/ux-inspector.spec.js');
  }

  // ── BUYER PERSONA ──────────────────────────────────────────────────────
  const BUYER_PERSONA = 'Mid-market IT buyer (procurement manager, not technical, first-time user)';

  await page.goto(`${BASE}/index.html`);
  await page.waitForTimeout(2000);
  await captureAndAnalyze(page, 'Homepage', BUYER_PERSONA, 'First time landing on site from a Google ad. Has never heard of this platform.');

  await page.goto(`${BASE}/how-it-works-buyer.html`);
  await page.waitForTimeout(1500);
  await captureAndAnalyze(page, 'How It Works — Buyer', BUYER_PERSONA, 'Clicked "Learn more" from homepage. Trying to understand what this platform does before signing up.');

  await page.goto(`${BASE}/bidbridge-get-started.html`);
  await page.waitForTimeout(1500);
  await captureAndAnalyze(page, 'Get Started Page', BUYER_PERSONA, 'Clicked "Get Started". Deciding whether to create an account or leave.');

  await page.goto(`${BASE}/bidbridge-auth_1.html`);
  await page.waitForTimeout(1500);
  await captureAndAnalyze(page, 'Sign In / Sign Up', BUYER_PERSONA, 'Ready to create an account. First time seeing the login/signup screen.');

  // Click signup tab
  await page.locator('button:has-text("Create account"), [onclick*="signup"]').first().click();
  await page.waitForTimeout(800);
  await captureAndAnalyze(page, 'Create Account Form', BUYER_PERSONA, 'Clicked "Create account". Filling out the signup form for the first time.');

  // Sign in and review dashboard
  await signIn(page, BUYER.email, BUYER.password, /buyer-dashboard/);
  await captureAndAnalyze(page, 'Buyer Dashboard — After Login', BUYER_PERSONA, 'Just logged in. First thing they see. Should immediately understand what to do next.');

  await page.goto(`${BASE}/bidbridge-submit-rfq_2.html`);
  await page.waitForTimeout(2000);
  await captureAndAnalyze(page, 'Submit RFQ Form', BUYER_PERSONA, 'Clicked "New RFQ". Trying to post their first procurement request. May not know what an RFQ is.');

  await page.goto(`${BASE}/bidbridge-my-rfqs.html`);
  await page.waitForTimeout(3000);
  await captureAndAnalyze(page, 'My RFQs', BUYER_PERSONA, 'Looking at their submitted RFQs. Wants to track status and see if bids have come in.');

  await page.goto(`${BASE}/bidbridge-compare-bids_1.html`);
  await page.waitForTimeout(3000);
  await captureAndAnalyze(page, 'Compare Bids', BUYER_PERSONA, 'Received bids and wants to compare them. Critical decision-making screen.');

  await page.goto(`${BASE}/bidbridge-exec-summary.html`);
  await page.waitForTimeout(3000);
  await captureAndAnalyze(page, 'Executive Summary', BUYER_PERSONA, 'Reviewing procurement spend and outcomes. May share this with their CFO or management.');

  await page.goto(`${BASE}/bidbridge-profile.html`);
  await page.waitForTimeout(2000);
  await captureAndAnalyze(page, 'Buyer Profile', BUYER_PERSONA, 'Setting up their profile for the first time. Wants their company info to look professional to resellers.');

  await page.goto(`${BASE}/bidbridge-settings.html`);
  await page.waitForTimeout(2000);
  await captureAndAnalyze(page, 'Buyer Settings', BUYER_PERSONA, 'Exploring settings. Wants to control notifications and account preferences.');

  await page.goto(`${BASE}/bidbridge-notifications_1.html`);
  await page.waitForTimeout(2000);
  await captureAndAnalyze(page, 'Notifications', BUYER_PERSONA, 'Checking notifications. Wants to see updates on their RFQs without hunting.');

  // ── RESELLER PERSONA ───────────────────────────────────────────────────
  const RESELLER_PERSONA = 'IT VAR (value-added reseller) sales rep, mobile-first, wants to bid quickly and win deals';

  await page.goto(`${BASE}/how-it-works-reseller.html`);
  await page.waitForTimeout(1500);
  await captureAndAnalyze(page, 'How It Works — Reseller', RESELLER_PERSONA, 'A reseller heard about this platform from a colleague. Checking if it\'s worth their time.');

  await page.goto(`${BASE}/bidbridge-reseller-apply_1.html`);
  await page.waitForTimeout(2000);
  await captureAndAnalyze(page, 'Reseller Application Form', RESELLER_PERSONA, 'Decided to apply. Filling out application for the first time. Wants it to be fast.');

  await signIn(page, RESELLER1.email, RESELLER1.password, /reseller-dashboard/);
  await page.waitForTimeout(3000);
  await captureAndAnalyze(page, 'Reseller Dashboard', RESELLER_PERSONA, 'Just logged in. First impression of their command center. Should see opportunities immediately.');

  await page.goto(`${BASE}/bidbridge-reseller-open-rfqs.html`);
  await page.waitForSelector('#open-rfq-grid', { timeout: 20000 });
  await page.waitForTimeout(3000);
  await captureAndAnalyze(page, 'Browse Open RFQs', RESELLER_PERSONA, 'Looking for RFQs to bid on. Should be easy to find relevant opportunities quickly.');

  // Click first card to show bid modal
  const firstCard = page.locator('#open-rfq-grid .rfq-card').first();
  if (await firstCard.count() > 0) {
    await firstCard.click();
    await page.waitForTimeout(2000);
    await captureAndAnalyze(page, 'Bid Submission Modal', RESELLER_PERSONA, 'Opening an RFQ to bid on it. This is the most important action — it must be fast and clear.');
    // Close modal
    const cancel = page.locator('.btn-cancel-bid, button:has-text("Cancel")').first();
    if (await cancel.count() > 0) await cancel.click();
  }

  await page.goto(`${BASE}/bidbridge-reseller-my-bids.html`);
  await page.waitForSelector('#bids-list', { timeout: 20000 });
  await page.waitForTimeout(3000);
  await captureAndAnalyze(page, 'My Bids — Active', RESELLER_PERSONA, 'Tracking their submitted bids. Wants to know immediately where they stand vs competitors.');

  // Switch to Won tab
  const wonTab = page.locator('#tab-won').first();
  if (await wonTab.count() > 0) {
    await wonTab.click();
    await page.waitForTimeout(1000);
    await captureAndAnalyze(page, 'My Bids — Won', RESELLER_PERSONA, 'Looking at their wins. Should feel rewarding and show what to do next (contact buyer).');
  }

  await page.goto(`${BASE}/bidbridge-reseller-messages.html`);
  await page.waitForTimeout(3000);
  await captureAndAnalyze(page, 'Reseller Messages Inbox', RESELLER_PERSONA, 'Checking messages from buyers. Post-award communication is critical to closing deals.');

  await page.goto(`${BASE}/bidbridge-reseller-profile.html`);
  await page.waitForTimeout(2000);
  await captureAndAnalyze(page, 'Reseller Profile', RESELLER_PERSONA, 'Setting up their company profile. Buyers will see this when reviewing bids — first impressions matter.');

  await page.goto(`${BASE}/bidbridge-reseller-settings.html`);
  await page.waitForTimeout(2000);
  await captureAndAnalyze(page, 'Reseller Settings', RESELLER_PERSONA, 'Configuring notification preferences and account settings.');

  // Generate the HTML report
  generateHTMLReport();

  console.log('\n✅ UX Inspection complete.');
  console.log(`   Open the report: open ux-report/ux-report.html`);
});
