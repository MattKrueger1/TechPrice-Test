# BidBridge / IT Pricing Network — Design Audit
**Audited:** 2026-05-22  
**Viewport:** 1440px wide  
**Pages reviewed:** 16 (homepage, auth, 7 buyer app pages, 5 reseller app pages, 3 marketing pages)

---

## Summary

The design system is well-conceived — the indigo-on-navy palette is distinctive, the Inter typeface is a strong choice, and the component vocabulary (pill badges, left-border unread indicators, stat cards) is internally coherent and professional. However, the implementation has drifted across pages: sidebar widths, stat card font sizes, button border-radii, and topbar backgrounds all differ by 1–3px between files, signaling that CSS was copy-pasted and then locally modified rather than maintained from a shared stylesheet. The most serious usability problem is raw internal data bleeding into the UI — `WIDGET_TEST_` and `BULK_SEED_` prefixed RFQ names are visible on the buyer dashboard, My RFQs, and Compare Bids — which will erode trust immediately with any real user who sees them. A secondary critical issue is that the Executive Summary page was captured in a full-screen "RFQ not found" error state, meaning the screenshot represents a broken flow with no recovery path beyond a text link. After addressing those two issues, the main improvement opportunities are reducing information density in the reseller dashboard (which renders hundreds of RFQ cards with no pagination), improving empty-state design on the buyer dashboard, and tightening consistency across all app-shell pages.

---

## Cross-Cutting Issues

These problems exist on multiple pages and should be fixed at the component/shared level.

### 1. Sidebar width inconsistency
- **Buyer app-shell** (`bidbridge-buyer-dashboard_2.html`, `bidbridge-my-rfqs.html`, `bidbridge-compare-bids_1.html`, et al.): `.app-shell { grid-template-columns: 240px 1fr }`
- **Reseller app-shell** (`bidbridge-reseller-dashboard.html`): `.app-shell { grid-template-columns: 260px 1fr }`
- The 20px difference is invisible in isolation but noticeable if a user ever switches role or compares pages. Pick one value — 240px works fine — and apply it to both.

### 2. Stat card font-size drift
- **My RFQs**: `.stat-value { font-size: 32px }`, `.stat-label { font-size: 12px }`
- **Reseller Dashboard**: `.stat-value { font-size: 30px }`, `.stat-label { font-size: 11px }`
- These numbers should be identical across every page. Standardize on `32px` / `12px`.

### 3. Button border-radius inconsistency
- `.btn-outline` on notifications: `border-radius: 8px`
- `.btn-outline` on compare bids: `border-radius: 10px`
- `.btn-primary` on homepage: `border-radius: 10px`
- `.btn-primary` on compare bids: `border-radius: 10px`
- `.btn-signout`: `border-radius: 8px`
- The 8px/10px split is a maintenance accident. Choose 10px as the standard for all secondary/outline buttons and apply consistently.

### 4. Topbar background inconsistency
- Dashboard: `background: rgba(11,27,51,0.85)`
- My RFQs, Compare Bids, Notifications, Profile, Settings: `background: rgba(11,27,51,0.9)`
- Unify to `rgba(11,27,51,0.9)` across all app-shell pages.

### 5. Raw internal IDs exposed in production UI
- The buyer dashboard "Action needed" section shows: `WIDGET_TEST_1775672274017_REVIEW` and `WIDGET_TEST_1775672196966_REVIEW`
- My RFQs shows: `BULK_SEED_Dell Technologies Refresh 18`, `BULK_SEED_Microsoft Refresh 08`, etc.
- Compare Bids left rail shows dozens of `BULK_SEED_` prefixed entries
- These are test data artifacts. While the underlying fix is data hygiene, the UI should also never display raw internal name prefixes. The RFQ title display component should strip or truncate known prefixes, or a warning banner should indicate "test data" mode.

### 6. Emoji nav icons have inconsistent rendering
All sidebar nav items use emoji characters (`🖥`, `⚖️`, `💬`, `🔔`, `⚙️`, `👤`) as `.nav-icon`. On most operating systems these render at inconsistent sizes and baselines. At `font-size: 16px` with `width: 20px` centering, several emoji exceed their box and look misaligned. Replace all emoji icons with a consistent SVG icon set (Heroicons, Lucide, or Phosphor — all free and MIT-licensed).

### 7. --slate text on --navy fails contrast in body copy contexts
`--slate: #8896A9` on `--navy: #0F1117` yields approximately 4.0:1 contrast ratio — just above the 3:1 threshold for large text, but below the 4.5:1 required for body text under WCAG AA. This color combination is used for:
- `.stat-label` (12px uppercase — counts as large text, passes at 3:1, but only barely)
- `.rfq-meta-line` (12px body — fails)
- `.notif-time` (11px — fails)
- `.user-role` (11px — fails)
- `.sidebar-section-label` (11px — fails)
Increase `--slate` to `#9AAABB` (approximately 4.8:1 on #0F1117) or darken the background behind these elements.

### 8. `--font-head` and `--font-body` are identical
Both are `'Inter', sans-serif`. The distinction adds no value and adds confusion to the codebase. Remove `--font-head` and use `--font-body` (or just `font-family: var(--font-body)`) everywhere.

### 9. No shared stylesheet — every page duplicates 200+ lines of sidebar/nav CSS
The sidebar, topbar, nav-item, user-block, and btn-signout CSS is copy-pasted verbatim into every file. This is the root cause of all the drift issues above. Extracting a `shared.css` is the systemic fix that makes all consistency issues easier to maintain. (This is a P3 refactor, but it's the lever that makes P1/P2 fixes permanent.)

### 10. No visible focus styles in screenshots
No `:focus-visible` ring is evident on any interactive element. The default browser outline has been suppressed by `outline: none` on inputs (e.g., `.search-input { outline: none }`). This is an accessibility blocker for keyboard users. Add a visible focus ring: `outline: 2px solid var(--accent); outline-offset: 2px` on all interactive elements.

---

## Page-by-Page Findings

---

### 00 — Homepage (`index.html`)

**Visual hierarchy**
The hero headline "The marketplace where the market sets the price — not personal relationships." is strong and readable at `clamp(38px, 5vw, 68px)`. However, the accent highlight on "market" is the exact same color (`--accent: #6366F1`) used for every interactive element on the page, which dilutes its emphasis. Consider using a slightly lighter violet (`#818CF8`) for inline text highlights to differentiate them from clickable links.

**Stats bar**
The three social-proof stats (`3+`, `18+`, `500+`, `200+`) appear as four items, but the four-column layout means the last stat breaks alignment. The numbers (`3`, `18`, `500`, `200`) are also very modest for a B2B marketplace — buyers will question them. If these are real counts, make them more specific (e.g., "500+ bids submitted"). The text is too small at the captured zoom level to read clearly.

**"Four steps" section**
The four step cards all have the same visual weight — there's no progressive emphasis to guide the eye left-to-right. Add a subtle connecting arrow or step number styling to reinforce sequence.

**"Whether you buy or sell" section**
Two side-by-side cards work well but the feature list text is too small (appears ~13px) and the bullet items have low contrast. Increase to 14px and use `--slate-light` instead of `--slate` for body text inside feature cards.

**"What a bid looks like" section**
The UI mockup embedded here is very small — it's unclear what it's showing. It appears to be the compare bids interface. Either enlarge it to at least 600px wide or replace with a purpose-built illustration at that section width.

**"Every major vendor" section**
The vendor logo row appears to be text-only vendor names rather than actual logos. On a marketplace app, showing real vendor logos (Cisco, Dell, HP, etc.) builds instant credibility. Even simple SVG wordmarks would be a significant improvement.

**"What buyers are saying" testimonial**
Only one testimonial is visible. A single quote looks like the minimum viable social proof. Use a 2–3 quote carousel or show 2 cards side-by-side.

**Footer**
The footer uses a multi-column layout that is reasonable but the link text appears the same `--slate` color as general muted text — there's no visual distinction between footer navigation links and static text.

---

### 01 — Auth page (`bidbridge-auth_1.html`)

The screenshot captured here is the **buyer dashboard** (the user was already authenticated), not the auth page. The auth page design could not be audited from this screenshot. A separate audit screenshot of the logged-out auth page is needed.

---

### 02 — Buyer Dashboard (`bidbridge-buyer-dashboard_2.html`)

**Stat cards**
The four stat cards (`Active RFQs: 24`, `Total Bids: 28`, `Ready to Review: 1`, `Deals Awarded: 24`) use three different text colors — `--accent` (blue), no accent, `--gold`, and white — creating visual inconsistency. The "Ready to Review" card uses `--gold` for `1`, which is good (draws urgency). But "Active RFQs: 24" uses `--accent` blue while "Total Bids: 28" uses plain white (`--white`) — there's no logic to the color difference. Apply a consistent rule: gold = needs action, accent = informational, white = completed/neutral.

**"Action needed" section**
- The second action item reads "0 bids ready to compare" on `WIDGET_TEST_1775672196966_REVIEW`. An item with 0 actionable bids should not appear in an "Action needed" section — it contradicts the label and creates noise.
- The third item "BULK_SEED_Dell Technologies Refresh 18" exposes raw test data naming. (See Cross-cutting #5.)
- The "Compare bids →" buttons use `--gold` (`#F5C842`) background with `--navy` (`#0F1117`) text — this is the only place a gold-background button appears in the app. Everywhere else, primary actions use `--accent` (indigo). This introduces an inconsistent button style. Change to standard `--accent` background or explain the semantic distinction (gold = deadline urgency?) in a design token.

**"Bid activity" empty state**
"No recent activity yet. Activity will appear here as resellers bid on your RFQs." is rendered in a large empty box at roughly `14px --slate-light`. For a buyer with 24 active RFQs and 28 bids, this empty state is confusing — the data exists but isn't loading or isn't connected. The empty state copy assumes true zero-data, but the stat cards contradict it. Either connect this component to real bid data or show a skeleton/loading state.

**Quick Links sidebar panel**
The quick links panel on the right side duplicates the sidebar navigation exactly (Post RFQ, My RFQs, Compare Bids, Messages, Notifications). This adds zero value for a user who can see the sidebar. Replace this with genuinely useful shortcuts like "RFQs closing in 48 hours" or "Unread messages."

**Layout**
The main content area uses an informal two-column layout (main left, quick links/closing soon right). The column split is approximately 65/35. The right column content (quick links, closing soon) looks like an afterthought — both panels lack visual weight. Give the "Closing soon" panel a colored left border (gold) to reinforce urgency semantics.

---

### 03 — My RFQs (`bidbridge-my-rfqs.html`)

**Information density**
The screenshot shows approximately 24 RFQ cards in a continuous list with no pagination, infinite scroll indicator, or "load more" button. With 24 items at roughly 70px card height each, the list is ~1680px tall before the user has done anything. This is manageable now but will degrade with more data. Add pagination (25 per page) or virtual scrolling.

**Stat cards as filters**
The four stat cards (`Active: 21`, `Ready to Review: 1`, `Awarded: 24`, `Cancelled: 0`) double as clickable filters. This is a clever pattern but the filter affordance is invisible — there's no visual cue that the cards are interactive until hover. The `.stat-card:hover { border-color: rgba(255,255,255,0.15) }` hover change is too subtle. Add a `cursor: pointer` (already present) plus a more visible hover state — e.g., add `box-shadow: 0 0 0 1px var(--accent)` on hover for the active-filter state preview.

**RFQ title truncation**
`.rfq-title { max-width: 480px; overflow: hidden; text-overflow: ellipsis }` truncates titles at 480px. Given the card width is approximately 1100px (1440px viewport minus 240px sidebar minus 40px+40px padding), 480px is less than half the available space. Increase to `max-width: 640px` or remove the hard max-width and use `min-width: 0` on the flex parent instead.

**Status badge color overlap**
`.s-active` and `.s-awarded` use the same `--accent` color, just with slightly different background opacities (`rgba(99,102,241,0.1)` vs `rgba(99,102,241,0.08)`). These are functionally identical statuses from a visual scanning perspective. "Awarded" should feel meaningfully different from "Active." Use a distinct color for awarded status — consider green (`#34D399`) or keep gold with a checkmark icon.

**Cancelled count card**
The "Cancelled: 0" stat card uses `--error` red for the `0` value. Displaying `0` in red communicates alarm — the user has no cancelled RFQs, which is good news. Don't use the error color for zero counts of negative things. Use `--slate` for zero values on error-semantic stats.

**"Showing 1-24 of 24 RFQs" footer**
Correct and useful, but the font is 13px `--slate` at the very bottom of a long list. Make this more prominent or move it to the topbar row (next to the filter pills).

---

### 04 — Submit RFQ (`bidbridge-submit-rfq_2.html`)

**Step indicator**
The 4-step progress indicator is clear and well-positioned. Step connectors are rendered as `height: 1px; background: rgba(255,255,255,0.1)` — barely visible on the dark background. Increase to `rgba(255,255,255,0.2)` or add color to completed connectors (e.g., `var(--accent)` at 40% opacity).

Completed steps use `background: rgba(99,102,241,0.15)` with `color: var(--accent)` — this reads as "accent outline" which looks the same as the active step from a distance. Use a filled checkmark icon (✓) inside the step circle for completed steps to make the distinction unambiguous.

**Form field sizing**
"HQ city" and "HQ state" are side-by-side at `1fr 1fr`. City names are typically longer strings and state is a short dropdown — a `2fr 1fr` split would feel more natural and reduce the awkwardly wide state dropdown.

**Date input styling**
The bid deadline field uses a native `<input type="date">`. On macOS Chrome, the native date picker renders with a default calendar icon that conflicts with the custom dark styling. Add `::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.5); }` to tint the icon to match the color scheme.

**"Supporting documents" drag-and-drop zone**
The zone uses a paperclip emoji icon (🖇️) which renders inconsistently across OSes. Replace with an SVG upload icon. The zone border is `dashed` — the dashes are very faint at `1px rgba(255,255,255,0.15)`. Increase to `rgba(255,255,255,0.25)` so the drop zone boundary is visible.

**"Next: Vendors & products →" CTA**
The button is right-aligned at the bottom of the form, which is standard. However, it uses `background: var(--accent)` at full opacity without a hover color change in the topbar context (the button lives inside `.page-body`). The hover state exists in `.btn-new` and `.btn-primary` globally but confirm it's applied here.

**No auto-save or "unsaved changes" indicator**
Multi-step forms should persist progress. There's no visible indication of draft saving. Add a "Draft saved" indicator (small grey text near the step indicator, e.g., "Draft saved at 2:14 PM") that appears on input.

---

### 05 — Compare Bids (`bidbridge-compare-bids_1.html`)

**Left rail RFQ list**
The rail items use `.rfq-rail-title { font-size: 13px }` and `.rfq-rail-meta { font-size: 11px }`. At 284px rail width, 13px is readable but tight. The bigger issue is that the rail contains dozens of `BULK_SEED_` prefixed entries (see Cross-cutting #5), making it nearly impossible to find real RFQs in testing or production.

The rail header reads "YOUR RFQS" at `font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em`. At this size and tracking, it looks more like a decorative label than navigation context. Increase to `12px` and add a search input inside the rail to filter by name.

**Bid card grid columns**
`.bid-row-summary { grid-template-columns: 36px 1fr 130px 130px 110px 180px }` — the fixed-pixel column widths for price, savings, and submitted are sensible but "Savings" (130px) and the action column (180px) don't scale with viewport or content. If a reseller name is very long, it compresses the `1fr` reseller column. Test with a 30-character company name.

**"0 bids ready to compare" noise**
Visible on the dashboard, and the compare bids page itself shows the interface for an RFQ with bids. But if a user navigates to Compare Bids for an RFQ with 0 bids, they should see a clear empty state ("No bids yet — check back when your deadline has passed") rather than an empty grid.

**View toggle (Card / Side by side)**
The toggle between "List view" and "Side by side" view is well-placed in the topbar. However, the active toggle uses `background: var(--navy-light)` with `color: var(--accent)` — this is subtle. A more obvious active state would use `background: var(--accent)` with `color: var(--navy)` (inverted) to match the selected-pill pattern used throughout the rest of the app.

**"Send a message to all bidders" bar**
The broadcast bar (`background: var(--navy-mid); border: 1px solid var(--card-border)`) looks nearly identical to a regular card. It should use a distinct background (e.g., `rgba(99,102,241,0.05)`) with an accent left border to stand out as a special action, not just another content block.

**Bid ranking**
`.bid-row-rank.first { color: var(--accent) }` — only the first-ranked bid is visually differentiated with an accent-colored rank number. Consider adding a `🥇`/`🥈`/`🥉` tier indication or at minimum a subtle background tint on the top bid row to make award-decision scanning faster.

---

### 06 — Executive Summary (`bidbridge-exec-summary.html`)

**Critical: Error state is the captured state**
The screenshot shows the full-page error: a grey warning triangle (⚠️, approximately 40px, very low contrast on `--navy` background), red text "RFQ not found.", and a text link "← Back to My RFQs." This is the state a user sees if they navigate to the exec summary with a bad/expired RFQ ID.

Issues with this error state:
1. The warning triangle icon at ~40px on pure black background has approximately 2:1 contrast. It's barely visible. Use `var(--error)` or `var(--gold)` for the icon fill.
2. "RFQ not found." uses `var(--error)` red. This is appropriate for an error but the message is too terse — it doesn't tell the user why. Expand to: "This RFQ could not be found. It may have been deleted, or the link may be outdated."
3. The recovery link "← Back to My RFQs" is styled as a plain `<a>` link in accent blue, centered on the page — no button treatment. Users may miss it. Replace with a styled `.btn-primary` button: "Go to My RFQs."
4. The "Save as PDF / Print" button in the top-right remains fully visible and active even in the error state, which is confusing (you can't print an error page that's empty). Hide or disable this button when in the error state.

---

### 07 — Notifications (`bidbridge-notifications_1.html`)

**Filter bar tab overflow**
The filter pills — "All", "Unread", "Bids", "Rank changes", "Awards", "Deadlines", "Messages" — are shown on a single row at 860px max-width. At 1440px viewport, the `max-width: 860px` on `.page-body` means the filter bar has plenty of room. But if max-width is ever adjusted or viewport narrows, the pills will wrap. This is acceptable behavior, but worth adding `overflow-x: auto; flex-wrap: nowrap` with `padding-bottom: 4px` to the `.filter-bar` to allow horizontal scroll as a fallback.

**Notification list density**
The screenshot shows 12+ consecutive notifications all reading "New bid received on [RFQ name]" with nearly identical content. The notification body text is `.notif-body { font-size: 13px; color: var(--slate-light) }`. When all notifications are the same type, they become a wall of identical text. Three improvements:
1. Group same-type notifications for the same RFQ ("3 new bids received on Test Cisco refresh").
2. Bold the RFQ name within the notification body.
3. Show the bid amount in the notification body for "New bid received" events — this is the one number a buyer most wants to see.

**Unread dot size/placement**
The unread dot (`.unread-dot { width: 8px; height: 8px }`) appears at the far right of each notification row. For read notifications it becomes `background: transparent; border: 1.5px solid rgba(255,255,255,0.12)` — a faint empty circle that adds visual clutter without meaning. Remove the circle entirely for read notifications; just remove the element.

**"Mark all as read" button**
Visible in the topbar-right. Good. But no confirmation or feedback (e.g., toast "All notifications marked as read") is visible in the static screenshot. Ensure a toast notification appears after the action.

**Notification preferences card**
Referenced in CSS (`.prefs-card`) but not visible in the screenshot — it may be below the fold or not rendered when notifications exist. Consider making notification preferences accessible via a link/button within the filter bar row ("⚙ Preferences") rather than buried at the bottom of the list.

---

### 08 — Profile (`bidbridge-profile.html`)

**Page layout: two-column with sticky left sidebar**
The `grid-template-columns: 280px 1fr` with `position: sticky; top: 80px` on the profile sidebar is a solid pattern. However, the right column contains many long sections (Personal info, Company info, Password & security, Preferences, SMS notifications, Danger Zone) that make the right column ~3x taller than the left sidebar. The sticky sidebar floats up while the user scrolls through content below it, creating an awkward visual relationship. Consider either breaking the right column into tabbed sections or adding in-page anchor navigation in the left sidebar.

**Stats in the profile card**
"8 Active RFQs" and "3 Bids received" are shown as `.profile-stat-value { font-size: 20px; color: var(--accent) }`. Below the stats is a second row: "16 RFQs posting" and "$415k Total spend" — but these use a different visual treatment than the first pair. The inconsistency within the same card is jarring. Use identical `.profile-stat` styling for all four values.

**"Deactivate account" button in profile card**
`.btn-danger-outline` appears inside the profile card (left sidebar), immediately below the stats — no separator or warning context. A destructive action this serious should never be a single click away from the profile overview. Move it to the Danger Zone section on the right, which already has a warning banner context.

**Danger Zone section**
The Danger Zone at the bottom of the right column uses an amber/gold warning banner with `⚠️` icon — but `--gold` is also used throughout the app for "urgency" states that are not destructive (bid deadlines, closing soon). The semantic signal is diluted. For the Danger Zone specifically, use `--error` red as the banner accent color, not gold, to establish a distinct "destructive" semantic.

**Field view separator**
`.field-view { border-bottom: 1px solid rgba(255,255,255,0.05) }` is at 5% opacity — invisible on the `--navy-mid` background. Increase to `rgba(255,255,255,0.08)` to match `--card-border` and make the field separators visible.

**Password field**
The current password field renders as 12 filled dots (•••••••••••) which is correct. However the "Change password" link below it is styled identically to the "Edit" buttons on other sections. Make "Change password" a text button with `color: var(--accent)` and underline, distinct from section Edit buttons.

---

### 09 — Settings (`bidbridge-settings.html`)

**Left navigation panel**
The settings left nav has two sections: "General" (Notifications, Privacy, RFQ defaults) and "Account" (Billing, Integrations, Danger zone). The active item "Notifications" is indicated with `color: var(--accent)` and a slightly different background — correct pattern. However the Danger Zone appears as a nav item with the same `⚠️` yellow icon used for both "important" and "destructive" contexts (see Profile finding above). Give it a red color treatment to distinguish it.

**Left nav and content panel visual separation**
The left nav panel appears to float within the content area without a clear border. Add `border-right: 1px solid var(--card-border)` to the left nav panel to create a visible lane separation, matching the sidebar pattern used throughout the app.

**Toggle switches**
The blue toggle switches for email notifications are well-styled and clearly show on/off state. However, some toggles appear to have no visible label for what "off" means — for example "Platform updates & news" is shown as toggled off (grey). Adding a small "(off)" or "(on)" text label next to the toggle, or ensuring the description below is sufficient to understand the off state, would improve clarity.

**Dropdown controls**
"Bid update frequency" shows a `<select>` dropdown styled with `.sort-select` (background: rgba(255,255,255,0.04), border: 1px solid rgba(255,255,255,0.09)). On the far right of the settings card, these dropdowns look visually disconnected from their labels. Add 8px top/bottom padding between each row and use a more visible border (`rgba(255,255,255,0.15)`) on the select element.

**No save/apply button visible**
The settings page shows toggles and dropdowns but no explicit "Save settings" button is visible. If settings are auto-saved on change (which is the common pattern), add a subtle toast ("Settings saved") after each change to confirm. If they are not auto-saved, a sticky "Save changes" button at the bottom of the content panel is essential.

---

### 10 — Reseller Dashboard (`bidbridge-reseller-dashboard.html`)

**Extreme page length / no pagination**
The screenshot is extremely long — the reseller dashboard renders what appears to be 60+ RFQ cards in a single scrollable list with no pagination, filtering results in URL, or virtualization. This is the most severe density issue in the entire app. A reseller with access to 100+ RFQs will have an unusable page. Add server-side pagination (25 items per page) or at minimum a "Load more" button.

**RFQ card information hierarchy**
Each `.rfq-card` on the reseller dashboard has `padding: 24px 28px` and shows: title, status badge, deadline, vendor tags, bid count, and a "View bids / Submit bid" CTA button. The most important piece of information for a reseller deciding whether to bid — the RFQ's product list or estimated value — is absent from the card view. Show the top 1–2 requested vendors as inline tags (most cards do show vendor tags) and consider adding an estimated bid range if available.

**"New RFQ" banner**
The `.new-rfq-banner` (`.new-rfq-banner.visible { display: flex }`) is a good pattern for real-time alerts. But it only appears when explicitly triggered — in the screenshot it's not visible, meaning resellers have no immediate signal on page load that new RFQs match their vendor authorizations. Consider a persistent "X new RFQs since your last visit" badge at the top of the page even without the banner.

**Sidebar: reseller-specific profile block**
The `.sidebar-profile` block (company name + tier chips for each vendor) is a good reseller-specific addition not present in the buyer sidebar. However at `font-size: 12px` for tier rows and `font-size: 10px` for tier chips, this content is very hard to read. Increase tier row text to 13px and tier chips to 11px.

**"Bid submitted" card state**
`.rfq-card.bid-submitted { border-color: rgba(245,200,66,0.3); background: rgba(245,200,66,0.02) }` — the gold border is a nice signal but at 0.02 opacity on the background, the card interior is visually identical to unsubmitted cards. Strengthen to `rgba(245,200,66,0.05)` and add a small "Bid submitted ✓" badge in the top-right of the card.

---

### 11 — Reseller Profile (`bidbridge-reseller-profile.html`)

**Overall: very similar to buyer profile — well-structured**
The two-column layout (`280px` profile sidebar + form sections) mirrors the buyer profile and is consistent. The vendor authorization section is the reseller-specific highlight.

**Vendor authorization cards**
Each authorization shows vendor name, partner tier, expiration date, and a "Verified" badge. This is clean and useful. The "Add a new vendor authorization" section below uses a dashed-border affordance style — but the border is at very low opacity (cannot confirm exact value from screenshot; visually appears ~10%). Use at least `rgba(255,255,255,0.2)` for the dashed add-authorization box border.

**Profile stats**
"43 Bids won" and "5 Active bids" appear in the left sidebar as large accent numbers. Below: "83% Win rate" and "$3.4k Revenue (this mo.)." Revenue at `font-size` matching the win rate feels mismatched — revenue is arguably more important. These four stats are in a `2×2` grid, consistent with the buyer profile pattern.

**Danger Zone**
Same issue as buyer profile — uses gold warning styling. Should use red/error semantics. The copy reads "Deactivating your account will immediately withdraw all active bids and prevent you from accessing RFQs. Any ongoing deals will need to be resolved with buyers directly." This is clear and well-written. The button label should be "Deactivate account" (already appears to be), with a confirmation dialog required before action.

---

### 12 — Reseller Apply (`bidbridge-reseller-apply_1.html`)

**Marketing section vs. application form: two visual contexts**
The page has a clear two-section structure: a dark marketing left panel ("Become an authorized IT Pricing Network reseller") and a white/light application form on the right. However, the form section on the right appears to have a white or near-white background that creates a stark contrast with the dark left panel and the overall dark-theme brand. If the intent is dark-only, apply `background: var(--navy-mid)` to the form section and adjust all input/label colors accordingly.

**Step indicator: 3 steps**
The application flow (Company info → Vendor authorizations → Review & submit) uses a 3-step indicator at the bottom of the form panel. The active step circle styling here should match the 4-step wizard in Submit RFQ (currently both exist but may differ slightly). Ensure `.step-num.active` has identical styling in both files.

**Form layout**
Year founded, Company size, City, State, Company HQ fields use a multi-column grid. This is sensible. The "Brief company description" field with `(optional)` label is well-handled.

**Password creation in application form**
Creating a password at the bottom of a multi-step application is unusual UX placement. Users might not realize they're also creating an account. Make the account creation more prominent: add a visual separator and a heading like "Create your account" above the password field, distinct from the business information fields above.

**"Next: Vendor authorizations →" CTA**
The CTA button appears styled with `--accent` background — correct. But its border-radius and padding should match the Submit RFQ wizard's `.btn-primary` exactly. From the screenshot it appears slightly different (smaller padding), suggesting local CSS overrides.

---

### 13 — How It Works (`how-it-works.html`)

**Effective role-selection pattern**
The two large cards ("I'm a Buyer" / "I'm a Reseller") with role-specific descriptions and "See the [role] process →" links is an excellent pattern for a dual-sided marketplace. Clear, simple, well-proportioned.

**Wasted vertical space**
The page renders only the above-the-fold content — two cards and a headline — taking up the full viewport at 1440px. The bottom ~300px of the viewport is empty dark space. Either add below-the-fold content (a brief comparison table, FAQ, or "Already a member?" section) or reduce the hero vertical padding so the page doesn't feel empty.

**"+ The Platform" badge**
The eyebrow badge above "How does it work?" reads "+ The Platform" — this label is cryptic. It reads like a section tag from a template that was never updated. Replace with something meaningful like "The Process" or remove entirely.

**Card hover state**
The two role cards presumably have hover states but in the static screenshot they look flat with no clear call-to-action affordance beyond the text link. Add a border-color change and right-arrow animation on the card itself (not just the text link) to make the entire card feel clickable.

---

### 14 — How It Works — Buyer (`how-it-works-buyer.html`)

**Strong page structure**
The "Five steps to a better deal" section with numbered steps (1–5), step titles, and expandable descriptions is well-done. The step numbers are visually prominent. The CTA section at the bottom ("Ready to post your first RFQ?") is appropriately high-contrast.

**"Why it matters" sub-section**
Three benefit cards (Market-driven pricing, Unmatched efficiency, Complete transparency) use small icons at roughly 20px. The icon-to-text ratio favors text heavily — consider making icons 32px with a subtle background circle to give them more presence.

**Step description text**
Body text within each step appears approximately 13–14px in `--slate-light`. This is readable but at the bottom of the comfortable range for a marketing page where users are reading, not scanning. Increase to 15px for the step descriptions.

**CTA section background**
"Ready to post your first RFQ?" section uses a dark background that blends with the page. Add a subtle `background: rgba(99,102,241,0.05)` with a top border `1px solid rgba(99,102,241,0.15)` to visually demarcate the CTA from the content above.

**Breadcrumb "For the Buyer" label**
The breadcrumb at the top reads "← Back to How It Works / For the Buyer." The "For the Buyer" segment is visually identical to "Back to How It Works" — both in the same color. The current page label should be `color: var(--white)` to differentiate it from the navigation link.

---

### 15 — How It Works — Reseller (`how-it-works-reseller.html`)

**Same issues as Buyer page**
The structure mirrors the buyer page — same icon sizing, same step text size, same CTA section blending. All the same recommendations apply.

**"Apply as a reseller →" CTA**
The primary CTA button at the bottom uses `--accent` background. This is correct. However the CTA section heading "Ready to start competing?" is very similar font weight/size to the step headings above it, reducing its visual punch. Make the CTA heading `font-size: 28px; font-weight: 800` to distinguish it.

**"Verified status badge" callout**
"Verified status with buyers" is used as a social proof signal within one of the value cards. This is good — verified status is a key differentiator for the reseller side. Consider making this a standalone visual element (e.g., a large "✓ Verified partner" badge mockup) rather than a bullet point.

---

## Prioritized Fix List

---

### P1 — Critical UX Problems (Fix before any user testing or public launch)

**P1-1: Strip raw internal prefixes from all user-facing RFQ title display**
- Files: `bidbridge-buyer-dashboard_2.html`, `bidbridge-my-rfqs.html`, `bidbridge-compare-bids_1.html`, `bidbridge-reseller-dashboard.html`
- Change: In the JS function that renders RFQ titles, add a sanitize step: `title.replace(/^(WIDGET_TEST_|BULK_SEED_)[^_]*_?/g, '').trim() || title`. Alternatively, enforce a naming convention at RFQ creation time that strips test prefixes before display.
- Why: Users seeing `WIDGET_TEST_1775672196966_REVIEW` as an action item will immediately distrust the platform's production readiness. This is a credibility-destroying defect.

**P1-2: Fix Executive Summary error state**
- File: `bidbridge-exec-summary.html`
- Change: (a) Change the error icon from grey/white to `color: var(--gold)` or `color: var(--error)`. (b) Expand error message to "This RFQ could not be found. It may have been deleted, or the link may be outdated." (c) Replace the `<a>` text link with a `<button class="btn-primary">` Go to My RFQs `</button>` at `padding: 12px 28px`. (d) Add `display: none` to the "Save as PDF / Print" button when in error state via a `.error-state` body class.
- Why: The error state currently has a nearly invisible icon, a terse unhelpful message, and an easy-to-miss recovery link. This is the only escape route for a broken URL and it fails its job.

**P1-3: Remove "0 bids ready to compare" from "Action needed" section**
- File: `bidbridge-buyer-dashboard_2.html`
- Change: In the JS that renders action items, add `if (rfq.bid_count === 0) return;` (or the equivalent logic) before appending an item to the "Action needed" list. Items with 0 bids require no action.
- Why: An "Action needed" item that requires no action is contradictory. It teaches users to ignore the entire section.

**P1-4: Fix empty "Bid activity" state on dashboard when bids exist**
- File: `bidbridge-buyer-dashboard_2.html`
- Change: Investigate why the Bid activity section shows empty state despite 28 total bids shown in the stat card. Either connect the activity feed to live bid data, or if the feature is incomplete, replace the section with a "Recent bids on your RFQs" list that queries the `bids` table. If intentionally showing only very recent activity (last 24h), clarify: "No bid activity in the last 24 hours. See all bids →"
- Why: Users see "28 bids received" in the stat card and then "No recent activity yet" one scroll down. This is a direct contradiction that will cause confusion and support requests.

**P1-5: Add visible focus styles to all interactive elements**
- Files: All HTML files (shared fix)
- Change: Remove `outline: none` from `.search-input` and replace with `outline: 2px solid var(--accent); outline-offset: 2px` on `:focus-visible`. Add the same to `.btn-primary`, `.btn-outline`, `.nav-item`, `.filter-pill`, `.rfq-card`, `.toggle-btn`, and all `<select>` elements.
- Why: Keyboard-only users (including power users who prefer keyboard navigation and users with motor disabilities) have no way to track focus position on any page. This is an accessibility blocker.

**P1-6: Add pagination or "Load more" to reseller dashboard and My RFQs**
- Files: `bidbridge-reseller-dashboard.html`, `bidbridge-my-rfqs.html`
- Change: In the Supabase query that fetches RFQs, add `.range(0, 24)` (first page) and render a "Load more" button that appends the next 25. Alternatively, add `?page=1` URL parameter support and prev/next pagination controls. Show "Showing 1–25 of 87 RFQs" count.
- Why: Rendering 60+ RFQ cards on a single page is a performance and usability problem. Scrolling through 80 cards to find a specific RFQ is not viable at scale.

---

### P2 — Noticeable Improvements (Fix before public beta)

**P2-1: Standardize sidebar width to 240px across all pages**
- Files: `bidbridge-reseller-dashboard.html`, `bidbridge-reseller-profile.html`
- Change: `.app-shell { grid-template-columns: 240px 1fr }` (currently 260px on reseller pages).
- Why: Inconsistent layout widths create a jarring visual shift when role-switching or when comparing pages side-by-side.

**P2-2: Standardize stat card font sizes**
- Files: `bidbridge-reseller-dashboard.html` (and any other file where `stat-value` ≠ 32px or `stat-label` ≠ 12px)
- Change: `.stat-value { font-size: 32px }`, `.stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em }`. Confirm this is identical across all pages.
- Why: 30px vs 32px is invisible in isolation but creates a "off" feeling across the app.

**P2-3: Unify button border-radius to 10px**
- Files: All HTML files with `.btn-outline`, `.btn-signout`, `.btn-primary` variants
- Change: Set `border-radius: 10px` on all button variants. Exception: `.nav-badge` and `.filter-pill` intentionally use `border-radius: 999px` (pill shape) — keep those.
- Why: The current 8px/10px inconsistency will be immediately obvious to any designer reviewing the UI.

**P2-4: Unify topbar background to rgba(11,27,51,0.9)**
- Files: `bidbridge-buyer-dashboard_2.html`
- Change: `.topbar { background: rgba(11,27,51,0.9) }` (change from 0.85).
- Why: Minor but part of the overall consistency cleanup.

**P2-5: Replace emoji nav icons with SVG icons**
- Files: All app-shell HTML files
- Change: Replace emoji characters in `.nav-icon` spans with inline SVGs from Heroicons (MIT) or Lucide (ISC). Use `width: 18px; height: 18px; stroke: currentColor; fill: none` for stroke icons. Suggested icons: Dashboard→squares-2x2, My RFQs→document-text, Compare bids→scale, Messages→chat-bubble-left, Notifications→bell, Settings→cog-6-tooth, Profile→user-circle.
- Why: Emoji rendering is OS-dependent, inconsistent in size, and cannot be styled with CSS color. SVG icons inherit `currentColor` and resize perfectly.

**P2-6: Fix "Awarded" status badge to visually differ from "Active"**
- Files: `bidbridge-my-rfqs.html` (and any file with `.s-awarded`)
- Change: Change `.s-awarded` from `background: rgba(99,102,241,0.08); color: var(--accent)` to `background: rgba(52,211,153,0.08); color: #34D399; border: 1px solid rgba(52,211,153,0.2)`. Add a checkmark prefix glyph: `.s-awarded::before { content: '✓ '; }` or use a filled circle in green.
- Why: "Active" and "Awarded" are different lifecycle stages but currently look identical in the badge system. Users scanning a long RFQ list cannot distinguish them at a glance.

**P2-7: Improve Danger Zone to use error/red styling, not gold**
- Files: `bidbridge-profile.html`, `bidbridge-reseller-profile.html`, `bidbridge-settings.html`
- Change: In the Danger Zone section: change `background: rgba(245,200,66,0.07); border: 1px solid rgba(245,200,66,0.2)` to `background: rgba(255,107,107,0.07); border: 1px solid rgba(255,107,107,0.2)`. Change the icon color from gold to `var(--error)`.
- Why: Gold (`--gold`) is used throughout the app for urgency/deadline semantics that are not destructive. Using it for Danger Zone blurs the semantic distinction between "pay attention" and "you will lose data."

**P2-8: Fix rfq-title max-width truncation**
- File: `bidbridge-my-rfqs.html`
- Change: In `.rfq-title`, change `max-width: 480px` to `max-width: 640px`. Also add `min-width: 0` to `.rfq-card-body` (the flex parent) to ensure text-overflow ellipsis works correctly without a hard pixel max.
- Why: At 1440px viewport with 240px sidebar and 80px padding, available card width is ~1100px. 480px is less than half the space, causing useful title content to be truncated unnecessarily.

**P2-9: Increase --slate to improve text contrast**
- Files: All (shared CSS variable)
- Change: In each file's `:root`, change `--slate: #8896A9` to `--slate: #9AAABB`. This increases contrast against `#0F1117` from ~4.0:1 to approximately 4.9:1, passing WCAG AA for all text sizes.
- Why: 11px and 12px text in `--slate` currently fails WCAG AA contrast. This is a minimal change that improves accessibility without altering the visual character of the design.

**P2-10: Add "bid submitted ✓" indicator to reseller RFQ cards**
- File: `bidbridge-reseller-dashboard.html`
- Change: For `.rfq-card.bid-submitted`, add a `<span class="bid-submitted-badge">Bid submitted ✓</span>` in the card top-right with `background: rgba(245,200,66,0.12); color: var(--gold); font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; border: 1px solid rgba(245,200,66,0.25)`. Strengthen the card background: `background: rgba(245,200,66,0.04)` (up from 0.02).
- Why: Resellers need to instantly see which RFQs they've already bid on. The current gold-border signal is too subtle.

**P2-11: Group duplicate notifications and enrich bid notifications with amount**
- File: `bidbridge-notifications_1.html`
- Change: In the JS that renders notifications, group consecutive same-type/same-RFQ notifications: "3 new bids received on Test Cisco refresh" with an expand chevron to see individual bids. In the notification body for bid events, include the bid amount: "A new bid of $12,400 was submitted on [RFQ name]."
- Why: A wall of 12 identical "New bid received" rows destroys signal-to-noise ratio. The bid amount is the most critical piece of information and is currently absent.

**P2-12: Remove "Quick Links" panel from buyer dashboard**
- File: `bidbridge-buyer-dashboard_2.html`
- Change: Remove the Quick Links card from the right column entirely (it duplicates sidebar navigation). Replace with a "Recent bids" component that shows the last 5 bids across all RFQs with reseller name, amount, and RFQ name.
- Why: A panel that offers no information beyond the sidebar wastes the most valuable real estate on the most-visited page.

---

### P3 — Polish (Post-beta refinements)

**P3-1: Extract shared CSS to a single shared.css file**
- Files: Create `/shared.css`; update all HTML files to `<link rel="stylesheet" href="/shared.css">`
- Change: Move sidebar, topbar, nav-item, user-block, btn-signout, status-badge, filter-pill, and :root variable declarations into shared.css. Keep page-specific CSS in each file's `<style>` block.
- Why: This is the systemic fix for all cross-cutting consistency issues. Every future change to the sidebar needs to happen in one place, not 12.

**P3-2: Remove the --font-head / --font-body distinction**
- Files: All (shared CSS change)
- Change: Remove `--font-head: 'Inter', sans-serif` from `:root`. Replace all `font-family: var(--font-head)` references with `font-family: var(--font-body)`.
- Why: Both variables resolve to the same value. The duplication adds cognitive overhead without value.

**P3-3: Add "Draft auto-saved" indicator to RFQ submission wizard**
- File: `bidbridge-submit-rfq_2.html`
- Change: After any field input in the wizard, debounce 1500ms and call `localStorage.setItem('rfq_draft', JSON.stringify(formState))`. Show a `<span id="draft-status">Draft saved</span>` near the step indicator with `font-size: 12px; color: var(--slate)`. On page load, check for a saved draft and offer to restore.
- Why: Multi-step forms that lose progress on accidental navigation are a major friction point for B2B users who may take multiple sessions to complete an RFQ.

**P3-4: Step indicator connector color for completed steps**
- File: `bidbridge-submit-rfq_2.html`
- Change: In `.step.completed::after { background: rgba(99,102,241,0.4) }` (change from `rgba(255,255,255,0.1)`). Add `content: '✓'` inside `.step.completed .step-num` instead of the step number.
- Why: The progress indicator should make it visually obvious how far the user has progressed. Currently completed steps look nearly identical to incomplete steps.

**P3-5: Tint native date picker icon**
- File: `bidbridge-submit-rfq_2.html`
- Change: Add `::-webkit-calendar-picker-indicator { filter: invert(0.6) sepia(1) hue-rotate(200deg) saturate(0.5); cursor: pointer; }` to tint the calendar icon to match the indigo accent.
- Why: The default black calendar icon on the dark background creates a harsh contrast artifact on the date input.

**P3-6: Add search input to Compare Bids left rail**
- File: `bidbridge-compare-bids_1.html`
- Change: Add `<input type="search" class="rail-search" placeholder="Filter RFQs…">` inside `.rfq-rail-header`, styled as a compact search input (`font-size: 12px; padding: 6px 10px`). Filter `.rfq-rail-item` visibility on `input` event.
- Why: With 60+ RFQs in the rail, users need to filter to find the target RFQ. Without search, the left rail becomes as painful as the full My RFQs list.

**P3-7: Upgrade "How it works" role selection cards to full-card links**
- File: `how-it-works.html`
- Change: Wrap the entire `.role-card` in `<a href="...">`. Add `border: 1px solid rgba(255,255,255,0.08)` hover state that transitions to `border-color: var(--accent)` on hover. Add a subtle `transform: translateY(-2px)` on hover. Remove the text-only "See the buyer process →" link and replace with the card CTA.
- Why: Cards that look like cards should be clickable as cards. Hiding the only interactive affordance in a text link underestimates user intent.

**P3-8: Add success toast after "Mark all as read" action on notifications**
- File: `bidbridge-notifications_1.html`
- Change: After calling the Supabase update to mark notifications read, show a toast: `<div class="toast">All notifications marked as read</div>` that appears for 3s then fades out. Style: `background: var(--navy-light); border: 1px solid var(--card-border); border-radius: 10px; padding: 12px 20px; font-size: 14px; position: fixed; bottom: 24px; right: 24px`.
- Why: Absence of feedback after a click action creates uncertainty. Users will click again or wonder if it worked.

**P3-9: Improve vendor logo display on homepage**
- File: `index.html`
- Change: Replace the text-only vendor name list with properly sized SVG wordmarks (Cisco, Dell, HP, Lenovo, Palo Alto Networks, Fortinet, Juniper) displayed at `height: 28px; opacity: 0.55` on the dark background, with `filter: brightness(0) invert(1)` for white treatment. Arrange in a centered horizontal row with `gap: 48px`.
- Why: Vendor logos are instant credibility signals in B2B. Text names in a grid look like a list of links, not a partnership affiliation display.

**P3-10: Make "How it works" CTA section visually distinct from content**
- Files: `how-it-works-buyer.html`, `how-it-works-reseller.html`
- Change: For the final CTA section div, add `background: rgba(99,102,241,0.05); border-top: 1px solid rgba(99,102,241,0.15); margin-top: 80px; padding: 80px 64px`. Increase the heading to `font-size: 28px; font-weight: 800`.
- Why: The CTA section currently blends visually into the step content above it. It needs to feel like a distinct conversion moment, not just another section.
