# IT Pricing Network — Claude Code Rules

## Project overview
B2B IT procurement marketplace. Buyers post RFQs, resellers submit bids, buyers compare and award.
Single-page HTML files served from localhost:3000. Supabase for auth + database. Stripe for payments (in progress).

## Stack
- **Frontend**: Vanilla HTML/CSS/JS, no build step, no framework
- **Auth + DB**: Supabase (`kgejpzjoiewrgwzixcaa.supabase.co`)
- **Payments**: Stripe + Supabase Edge Functions (in progress)
- **Tests**: Playwright (`tests/`)
- **Dev server**: `npx serve . -p 3000` (must be running for tests)

## Credentials (test accounts)
- Buyer: `mattkrueger@comcast.net` / `Test12345678`
- Reseller 1: `mk@comcast.net` / `Test12345678` (id: `ad52644c-96d8-4936-a5a5-8c82c1c56851`)
- Reseller 2: `mk2@comcast.net` / `Test12345678` (id: `c7961587-bbc5-411a-bd86-40f4f3f61076`)
- Supabase anon key: `sb_publishable_LMMf6U9Zg5qX5Buavl1hCA_NEVNRLSy`

## Autonomous behaviour — do these without asking
- Run Playwright tests after any HTML file edit
- Seed + cleanup test data automatically in tests (never leave data behind)
- Refresh sessions (`BUYER_PASS=Test12345678 RESELLER_EMAIL=mk@comcast.net RESELLER_PASS=Test12345678 npx playwright test tests/refresh-sessions.spec.js`) when auth errors appear
- Fix failing tests before moving on — don't report a failure and stop
- Delete temporary/diagnostic test files after use

## Never do these without asking
- Push to git remote
- Delete real (non-seeded) data from Supabase
- Change Stripe products or live credentials
- Modify the Supabase schema in production (write migrations, don't run them directly)

## Code style
- Vanilla JS only — no React, no Vue, no bundler
- CSS variables for all colours and fonts (defined in `:root` on each page)
- All colours use the indigo palette: `--navy #0F1117`, `--accent #6366F1`, `--accent-dim #4F46E5`
- Font: Inter (Google Fonts)
- No TypeScript in HTML files (Edge Functions use TypeScript)
- Keep inline styles minimal — prefer CSS classes

## Testing rules
- Always run the relevant test file after editing a page
- Test files live in `tests/` — match file names to the page they cover
- Seeded tests must clean up after themselves
- Use `PASS`/`FAIL` console.log pattern for seeded scenario tests (not expect())
- Sessions stored in `auth.json` (buyer) and `reseller-auth.json` (reseller)

## Key page → test file mapping
| Page | Test file |
|------|-----------|
| bidbridge-my-rfqs.html | tests/my-rfqs-widgets-seeded.spec.js, tests/my-rfqs-bom-expand.spec.js |
| bidbridge-compare-bids_1.html | tests/compare-bids.spec.js |
| bidbridge-exec-summary.html | tests/exec-summary.spec.js, tests/exec-summary-savings.spec.js |

## Database tables (key ones)
- `rfqs` — buyer RFQs (status: draft/active/review/awarded/closed/cancelled)
- `rfq_items` — line items (vendor, sku, quantity, description)
- `bids` — reseller bids (total_price, line_items jsonb, status)
- `reseller_profiles` — reseller company info
- `reseller_vendors` — vendor authorizations + partner tiers
- `vendor_awards` — jsonb on rfqs: `{ "Cisco": "bid-uuid" }` — source of truth for split awards
- `subscriptions` — Stripe subscription state (in progress)
- `bid_credits` — per-bid credit balance (in progress)

## Supabase MCP
Use the Supabase MCP server for all database queries instead of manual REST API calls.
Project ref: `kgejpzjoiewrgwzixcaa`
