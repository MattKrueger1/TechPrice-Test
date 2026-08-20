# BidBridge Redesign — Master Feature Checklist
> Generated 2026-05-23. Every item here must be present and working in the new design.
> Cross-referenced against all Playwright tests. TEST: prefix = test references this ID. ✓ = test verifies this behavior.

---

## RESELLER SIDE

### R1 — Reseller Dashboard (`bidbridge-reseller-dashboard.html`)

#### Stats Bar (4 cards, all clickable)
- [ ] TEST: `#stat-open-rfqs` — count of open RFQs available to this reseller
- [ ] TEST: `#stat-active-bids` — count of pending/active bids
- [ ] TEST: `#stat-active-bids-sub` — sub-label ("X need attention" or "All bids in good standing")
- [ ] TEST: `#stat-win-rate` — win rate % (matches profile page value)
- [ ] TEST: `#stat-win-rate-sub` — sub-label ("X of Y bids won")
- [ ] TEST: `#stat-revenue` — revenue won, formatted ($Xk or $X.XM)
- [ ] TEST: `#stat-revenue-sub` — sub-label
- [ ] ✓ Stat cards are clickable and scroll to their respective section
- [ ] ✓ All stat cards show real values (not dashes) after data loads
- [ ] ✓ Win rate consistent with profile page

#### Sidebar / Header
- [ ] TEST: `#sidebar-company` — company name
- [ ] TEST: `#sidebar-tiers` — vendor authorization tiers list (populated from DB)
- [ ] TEST: `#sidebar-avatar` — user initials avatar
- [ ] TEST: `#sidebar-name` — user full name
- [ ] TEST: `#topbar-date` — current date display
- [ ] Navigation items: Dashboard, Open RFQs, My Bids, Won/Lost, Messages, Notifications, Profile
- [ ] ✓ All sidebar nav links navigate correctly

#### New RFQ Banner
- [ ] TEST: `#new-rfq-banner` — shown if new RFQs posted in last 48h
- [ ] TEST: `#new-rfq-banner-text` — count of new RFQs
- [ ] ✓ Banner is dismissible on click
- [ ] ✓ Banner disappears after dismissed

#### Alerts
- [ ] TEST: `#rank-alert` — rank change alert (hidden until triggered)
- [ ] TEST: `#rank-alert-text` — rank change message
- [ ] TEST: `#attn-strip` — attention strip

#### Section Counts
- [ ] TEST: `#section-count-open` — count in Open RFQs section header
- [ ] TEST: `#section-count-bids` — count in My Bids section header
- [ ] TEST: `#section-count-closed` — count in Won/Lost section header
- [ ] TEST: `#section-count-messages` — count in Messages section header

#### Open RFQs Section
- [ ] TEST: `#section-open-rfqs` — section container (scroll target)
- [ ] TEST: `#open-rfq-grid` — grid container
- [ ] Each `.rfq-card` contains:
  - [ ] RFQ title
  - [ ] Location (📍)
  - [ ] Vendor name(s)
  - [ ] Split bid vendor count pill (e.g. "1 of 3 vendors")
  - [ ] "NEW" tag for RFQs posted < 48h ago (class `.new-tag`)
  - [ ] "BID SUBMITTED" tag if already bid
  - [ ] Rank pill (class `.bid-rank-pill`) — shows rank WITHOUT revealing total bid count
- [ ] ✓ No min-tier badge (`rfq-meta-item`) on cards
- [ ] ✓ No tier-req tag (`.rfq-tag.tier-req`) on cards
- [ ] ✓ Clicking card opens bid submission modal
- [ ] Filter pills: "All RFQs", "Not submitted yet", "Submitted" (one active at a time)
- [ ] TEST: `#search-input` — search field filters by vendor/product/location

#### My Bids Section
- [ ] TEST: `#section-my-bids` — section container (scroll target)
- [ ] TEST: `#my-bids-list` — list container
- [ ] Filter pills (one active at a time):
  - [ ] TEST: `#mybids-pill-all` — All bids
  - [ ] TEST: `#mybids-pill-active` — Active (DEFAULT — not "All")
  - [ ] TEST: `#mybids-pill-won` — Won
  - [ ] TEST: `#mybids-pill-lost` — Lost
  - [ ] TEST: `#mybids-pill-cancelled` — Cancelled (red style)
- [ ] ✓ "Active" pill selected by default (not "All")
- [ ] Each bid card shows: status badge (WON / PARTIALLY WON / NOT SELECTED / CANCELLED), price, vendor, title
- [ ] ✓ Won bid card shows "WON" or "PARTIALLY WON" badge
- [ ] ✓ Lost bid card shows "NOT SELECTED" badge
- [ ] ✓ Clicking card opens bid summary modal

#### Bid Submission Modal (NEW BID)
- [ ] TEST: `#bid-modal` — modal container (class `hidden` by default)
- [ ] TEST: `#bid-modal-title` — modal title
- [ ] TEST: `#bid-modal-subtitle` — subtitle / split-bid banner
- [ ] TEST: `#bid-modal-body` — body (contains `.sku-table`)
- [ ] TEST: `#bid-modal-footer` — footer with buttons
- [ ] TEST: `#bid-error` — error message display
- [ ] TEST: `#bid-auth-checkbox` — authorization checkbox (required before submit)
- [ ] TEST: `#bid-submit-btn` — submit button (DISABLED until auth checkbox checked)
- [ ] TEST: `#bid-notes` — notes textarea
- [ ] TEST: `#bid-net-total` — net total display
- [ ] Price inputs: `#price-{idx}` per line item
- [ ] Line totals: `#line-total-{idx}` per line item (auto-calculated)
- [ ] ✓ Submit button disabled until auth checkbox checked
- [ ] ✓ Submit button enabled after checkbox checked
- [ ] ✓ Submit button disabled again if checkbox unchecked
- [ ] ✓ Auth checkbox resets to unchecked when modal reopens
- [ ] ✓ No budget info shown in modal
- [ ] ✓ Split-bid banner shown for split-bid RFQs
- [ ] Cancel button (class `.btn-cancel-bid`) closes modal
- [ ] `#bid-history-section` — previous bid history (for revisions)

#### Bid Summary Modal (WON/LOST — Read-Only)
- [ ] Shows status badge (WON / PARTIALLY WON / NOT SELECTED)
- [ ] Shows line items table (read-only)
- [ ] ✓ Split wins show only awarded vendors' line items
- [ ] ✓ Net total is non-zero for won bids
- [ ] `#won-buyer-contact` — buyer contact info (for won bids, async-loaded)

#### Bid Revision Overlay
- [ ] TEST: `#revise-overlay` — revision overlay
- [ ] TEST: `#revise-rfq-name` — RFQ name in revision context
- [ ] TEST: `#revise-rank-note` — rank/notes context
- [ ] TEST: `#revise-price` — price input
- [ ] TEST: `#revise-notes` — notes input

#### Won/Lost Section
- [ ] TEST: `#section-won-lost` — section container
- [ ] TEST: `#won-list` — won bid cards
- [ ] TEST: `#lost-list` — lost bid cards
- [ ] ✓ Won bid shows correct badges and awarded vendor lines only (split-bid awareness)

#### Messages Section (Inline — not overlay)
- [ ] TEST: `#section-messages` — section container
- [ ] TEST: `#msg-inbox-threads` — thread list
- [ ] TEST: `#msg-inbox-conv` — conversation area
- [ ] `#msg-conv-thread` — message thread (generated)
- [ ] `#msg-inbox-input` — message input (generated)
- [ ] ✓ Clicking thread marks as read (unread badge cleared)
- [ ] ✓ Message input visible when thread selected
- [ ] ✓ Reseller can send message to buyer
- [ ] TEST: `#msg-overlay` — message overlay popup
- [ ] TEST: `#msg-title`, `#msg-sub`, `#msg-input`, `#msg-thread` — overlay fields

#### Notification Drawer
- [ ] TEST: `#notif-badge` — bell badge count
- [ ] TEST: `#notif-drawer-badge` — drawer badge count
- [ ] TEST: `#notif-unread-label` — unread label text
- [ ] TEST: `#notif-drawer` — drawer panel
- [ ] TEST: `#notif-backdrop` — backdrop (clicks to close)
- [ ] TEST: `#notif-list` — notification list in drawer
- [ ] ✓ Drawer toggles on bell click
- [ ] ✓ Unread count shown

#### Sidebar Nav Badges
- [ ] `#badge-rfqs` — open RFQ count badge (hidden when 0)
- [ ] `#badge-bids` — active bid count badge
- [ ] `#badge-messages` — unread message count badge

---

### R2 — Reseller Profile (`bidbridge-reseller-profile.html`)

#### Profile Card / Stats
- [ ] TEST: `#profile-avatar` — large initials avatar
- [ ] TEST: `#profile-name` — full name
- [ ] TEST: `#profile-title-display` — job title
- [ ] TEST: `#profile-company-display` — company name
- [ ] Verified badge ("✓ Admin verified")
- [ ] TEST: `#stat-bids-total` — total bids submitted
- [ ] TEST: `#stat-deals-won` — deals won
- [ ] TEST: `#stat-win-rate` — win rate % (must match dashboard)
- [ ] TEST: `#stat-revenue` — revenue won
- [ ] ✓ All stats populated (not dashes)
- [ ] ✓ Win rate matches dashboard

#### Personal Information (edit/view mode)
- [ ] TEST: `#view-first` / `#input-first` — first name
- [ ] TEST: `#view-last` / `#input-last` — last name
- [ ] TEST: `#view-ctitle` / `#input-ctitle` — job title
- [ ] TEST: `#view-phone` / `#input-phone` — phone
- [ ] TEST: `#view-email` / `#input-email` — work email
- [ ] TEST: `#edit-personal` / `#save-personal` / `#cancel-personal` — edit controls
- [ ] ✓ Edit mode toggles fields view ↔ input
- [ ] ✓ Save updates display fields

#### Company Profile (edit/view mode)
- [ ] TEST: `#view-company` / `#input-company` — company name
- [ ] TEST: `#view-website` / `#input-website` — website
- [ ] TEST: `#view-city` / `#input-city` — city
- [ ] TEST: `#view-state` / `#input-state` — state
- [ ] TEST: `#view-desc` / `#input-desc` — description (textarea)
- [ ] TEST: `#edit-company` / `#save-company` / `#cancel-company` — edit controls
- [ ] ✓ Save updates sidebar company name + avatar

#### Vendor Authorizations
- [ ] TEST: `#vendor-list` — list container
- [ ] Each vendor card: name, status badge (✓ Verified / ⏳ Pending), tier badge (Silver/Gold/Platinum)
- [ ] Classes: `.vendor-auth-card.verified-card` or `.vendor-auth-card.pending-card`
- [ ] ✓ Vendor list loads and displays

#### Add Vendor Authorization Modal
- [ ] TEST: `#add-vendor-modal` — modal (class `.hidden` by default)
- [ ] TEST: `#av-vendor` — vendor dropdown (Cisco, Dell, HP/HPE, etc. + Other)
- [ ] Tier pills: TEST: `#tier-opt-silver`, `#tier-opt-gold`, `#tier-opt-platinum`
- [ ] TEST: `#av-doc-area` — document upload area
- [ ] TEST: `#av-upload-row` — upload row
- [ ] TEST: `#av-error` — error message
- [ ] TEST: `#av-submit-btn` — submit button (disabled until vendor + tier + doc selected)
- [ ] ✓ Modal opens on "Add vendor" button click
- [ ] ✓ Tier selection (one at a time)
- [ ] ✓ File upload shows filename and size
- [ ] ✓ Submit disabled until all required fields filled
- [ ] ✓ Validation errors shown
- [ ] ✓ Modal clears when reopened
- [ ] ✓ Vendor list refreshes after submission
- [ ] ✓ Success toast shown

#### Password & Security
- [ ] TEST: `#new-pwd` / `#confirm-pwd` — password inputs (hidden by default)
- [ ] TEST: `#pwd-fields` — container (hidden until "Change password" clicked)
- [ ] ✓ Password change validates (min 8 chars, must match)
- [ ] ✓ Success message shown on update

#### SMS Notifications
- [ ] TEST: `#section-sms` — SMS section
- [ ] TEST: `#sms-enabled` — enable toggle (checkbox)
- [ ] TEST: `#sms-phone` — mobile number input (visible only when enabled)
- [ ] TEST: `#sms-notify-rfq` — "Notify on new RFQ" checkbox
- [ ] TEST: `#sms-notify-deadline` — "Notify on deadline approaching" checkbox
- [ ] TEST: `#sms-sub` — sub-section (hidden until SMS enabled)
- [ ] TEST: `#save-sms` — save button
- [ ] ✓ Toggle shows/hides sub-section
- [ ] ✓ SMS prefs save successfully

#### Danger Zone
- [ ] "Deactivate account" button
- [ ] ✓ Confirmation dialog mentions bid withdrawal

---

### R3 — Notifications (`bidbridge-notifications_1.html` — reseller parts)

- [ ] TEST: `#unread-summary` — summary text ("X unread" or "All caught up")
- [ ] TEST: `#count-all` — count in All pill
- [ ] TEST: `#count-unread` — count in Unread pill
- [ ] TEST: `#notif-list` — notification list container
- [ ] Notifications grouped by date: Today / Yesterday / Earlier
- [ ] Each notification: icon, title, body, metadata, unread dot
- [ ] Notification types: new_rfq, bid_won, bid_lost, rfq_updated, rfq_cancelled, bid_deadline, message, system
- [ ] Filter pills: All, Unread, Bids, Rank changes, Awards, Deadlines, Messages, System
- [ ] TEST: `#prefs-card` — preferences panel (hidden by default)
- [ ] "Mark all as read" button
- [ ] ✓ Unread notification has filled dot + colored left border
- [ ] ✓ Clicking notification marks read, navigates to relevant page
- [ ] ✓ Unread filter shows only unread
- [ ] ✓ Mark all read removes all unread styling
- [ ] ✓ Unread count updates after marking read
- [ ] ✓ Summary text updates
- [ ] ✓ Filter pills toggle (one active)
- [ ] ✓ Seen state persists via localStorage

---

## BUYER SIDE

### B1 — Buyer Dashboard (`bidbridge-buyer-dashboard_2.html`)

#### Top Bar
- [ ] TEST: `#topbar-greeting` — buyer name greeting
- [ ] TEST: `#topbar-date` — current date
- [ ] TEST: `#user-avatar` — user initials avatar
- [ ] TEST: `#user-name` — user full name
- [ ] TEST: `#user-role` — role label
- [ ] ✓ Greeting shows buyer name (not generic)

#### Stats Bar (4 clickable cards)
- [ ] TEST: `#stat-active` / `#stat-active-sub` — Active RFQs
- [ ] TEST: `#stat-bids` / `#stat-bids-sub` — Total bids received
- [ ] TEST: `#stat-review` / `#stat-review-sub` — Ready to review
- [ ] TEST: `#stat-awarded` / `#stat-awarded-sub` — Deals awarded
- [ ] TEST: `#stat-active-card`, `#stat-bids-card`, `#stat-review-card`, `#stat-awarded-card` — card wrappers
- [ ] ✓ All 4 stat cards show real values (not dashes)
- [ ] ✓ Clicking stat card opens inline detail panel

#### Stat Detail Panel
- [ ] TEST: `#stat-detail-panel` — inline panel (hidden by default)
- [ ] TEST: `#stat-detail-title` — selected stat label
- [ ] TEST: `#stat-detail-body` — list of RFQs or bids
- [ ] ✓ Panel opens on stat click
- [ ] ✓ Active RFQs stat card opens inline panel with RFQ list

#### Action Section
- [ ] TEST: `#action-cards` — action cards container
- [ ] Shows up to 4 cards: Review bids / New bids received / Closing soon / Unread messages
- [ ] Shows "You're all caught up" if no actions needed
- [ ] TEST: `#activity-dropdown` — activity dropdown modal
- [ ] TEST: `#activity-modal-backdrop` — backdrop

#### Bid Activity Section
- [ ] TEST: `#notif-list` — bid activity list (recent bid submissions)
- [ ] Each item: reseller name, RFQ title, bid amount, savings, time ago
- [ ] ✓ Bid activity section always visible (with content or empty state)

#### Quick Links
- [ ] 5 links: Post RFQ, My RFQs, Compare bids, Messages, Notifications
- [ ] ✓ All quick links navigate correctly

#### Closing Soon Card
- [ ] TEST: `#upcoming-deadlines-card` — deadlines card (optional)
- [ ] TEST: `#upcoming-deadlines-list` — list of RFQs by deadline urgency

#### Sidebar Navigation
- [ ] Nav items: Dashboard, New RFQ, My RFQs, Compare bids, Messages, Notifications, Settings, Profile
- [ ] TEST: `#badge-rfqs` — active RFQ count badge
- [ ] TEST: `#badge-review` — review count badge
- [ ] TEST: `#badge-messages` — unread message count badge
- [ ] ✓ All nav items present and navigable
- [ ] ✓ Badges hidden when count = 0

#### Messages Panel
- [ ] TEST: `#nav-messages` — Messages nav item
- [ ] TEST: `#panel-messages` — messages panel (display:block when active)
- [ ] TEST: `#msg-inbox-threads` — thread list with RFQ group headers
- [ ] TEST: `.msg-rfq-group-header` — accordion group headers
- [ ] TEST: `.msg-reseller-list.open` — expanded reseller list
- [ ] TEST: `.msg-thread-item` — individual thread rows
- [ ] TEST: `#msg-inbox-conv` — conversation area
- [ ] TEST: `.msg-conv-header` — conversation header
- [ ] TEST: `#msg-inbox-input` — compose textarea
- [ ] TEST: `.btn-send` — send button
- [ ] ✓ Messages nav item visible
- [ ] ✓ Clicking Messages nav opens messages panel
- [ ] ✓ Thread list loads without JS errors
- [ ] ✓ RFQ group headers appear (accordion style)
- [ ] ✓ Clicking group header expands reseller threads
- [ ] ✓ Clicking reseller thread opens conversation
- [ ] ✓ Send button present for direct threads (not broadcast-only)

---

### B2 — Submit RFQ (`bidbridge-submit-rfq_2.html`)

#### Step Indicator
- [ ] TEST: `#step-indicator` — step bar container
- [ ] TEST: `#step-1`, `#step-2`, `#step-3`, `#step-4` — step markers
- [ ] `.step-num` circles highlight as active/completed
- [ ] ✓ Step indicator updates as you advance

#### Step 1: Project Details
- [ ] TEST: `#section-1` — section container (active by default)
- [ ] TEST: `#project-title` — project name (required)
- [ ] TEST: `#project-title-error` — error message
- [ ] TEST: `#project-desc` — description textarea (required, min 10 chars)
- [ ] TEST: `#project-desc-error` — error message
- [ ] TEST: `#project-deadline` — date picker (required, default = today + 7)
- [ ] TEST: `#project-deadline-error` — error message
- [ ] TEST: `#project-city` — HQ city (required)
- [ ] TEST: `#project-city-error` — error message
- [ ] TEST: `#project-state` — state dropdown with all 50 states + DC (required)
- [ ] TEST: `#project-state-error` — error message
- [ ] TEST: `#upload-area` — file dropzone (optional)
- [ ] TEST: `#file-input` — hidden file input
- [ ] TEST: `#file-list` — uploaded files list with remove buttons
- [ ] ✓ Validation prevents advancing without required fields
- [ ] ✓ Error messages appear inline below field

#### Step 2: Vendors & Products
- [ ] TEST: `#section-2` — section container
- [ ] Import bar:
  - [ ] TEST: `.import-bar` — spreadsheet import bar
  - [ ] TEST: `#import-file` — hidden file input
  - [ ] TEST: `#import-success` — success message after import
  - [ ] TEST: `#import-error` — error message on import fail
  - [ ] TEST: `#import-suggestions` — fuzzy-match vendor suggestions (Accept/Dismiss chips)
  - [ ] ✓ Download template generates XLSX (vendors + items sheets)
  - [ ] ✓ Upload parses XLSX/CSV, groups by vendor, fills dropdowns
  - [ ] ✓ Fuzzy-match suggestions appear for unrecognized vendors
- [ ] TEST: `#vendor-list` — vendor list container
- [ ] Each vendor item (`#vendor-item-{id}`):
  - [ ] TEST: `#vendor-name-{id}` — vendor dropdown (25 vendors + Other)
  - [ ] TEST: `#vendor-name-other-{id}` — "Other" text input (shown only when Other selected)
  - [ ] TEST: `#sku-list-{id}` — SKU rows container
  - [ ] Each SKU row: `#sku-part-{id}-{rowId}` (part #, REQUIRED), `#sku-qty-{id}-{rowId}` (qty, REQUIRED)
  - [ ] TEST: `#vendor-notes-{id}` — optional notes field
  - [ ] `.btn-add-sku` — add SKU row button
  - [ ] `.btn-remove-sku` — remove SKU row button
  - [ ] `.btn-remove-vendor` — remove vendor button (hidden for first vendor)
- [ ] `.btn-add-vendor` — add vendor button
- [ ] ✓ At least 1 vendor + 1 SKU required to advance
- [ ] ✓ Part number and quantity required per SKU row
- [ ] ✓ Vendor selection shows/hides "Other" text input

#### Step 3: Bidding Preferences
- [ ] TEST: `#section-3` — section container
- [ ] Strategy cards:
  - [ ] TEST: `#card-sole` — "One reseller bids everything" (RECOMMENDED, default selected)
  - [ ] TEST: `#strategy-note-sole` — note text for sole strategy
  - [ ] TEST: `#card-split` — "Each vendor bid separately"
  - [ ] TEST: `#strategy-note-split` — note text for split strategy
  - [ ] ✓ Strategy card selection works (toggles `.selected` class)
  - [ ] ✓ Split strategy disabled if only 1 vendor
- [ ] Tier filter:
  - [ ] TEST: `#tier-toggle` — checkbox to enable tier filtering
  - [ ] TEST: `#tier-options` — tier pills container (hidden until toggle on)
  - [ ] TEST: `.tier-pill` — tier pills (Authorized, Silver, Gold, Platinum)
  - [ ] ✓ Tier toggle shows/hides tier options
  - [ ] ✓ One tier pill selectable at a time

#### Step 4: Review & Submit
- [ ] TEST: `#section-4` — section container
- [ ] TEST: `#review-content` — review grid showing all RFQ data
- [ ] `.review-vendor-block` — per-vendor review blocks
- [ ] TEST: `#submit-btn` — submit button
- [ ] ✓ Review shows all fields: title, desc, deadline, location, strategy, vendors, SKUs
- [ ] ✓ Submit validates all steps, inserts to DB, creates notifications for eligible resellers
- [ ] ✓ Loading state shown on submit

#### Success Screen
- [ ] TEST: `#success-screen` — success container (hidden until submitted)
- [ ] TEST: `#rfq-id-badge` — RFQ ID display (first 8 chars uppercase)
- [ ] TEST: `#redirect-countdown` — countdown from 3 to 0
- [ ] ✓ "Your RFQ is live!" message shown
- [ ] ✓ Auto-redirects to My RFQs after 3s countdown
- [ ] ✓ "View My RFQs" link available
- [ ] ✓ "Submit another RFQ" button resets form

---

### B3 — My RFQs (`bidbridge-my-rfqs.html`)

#### Stat Widgets (4, each clickable to filter)
- [ ] TEST: `#stat-active` — Active RFQs count
- [ ] TEST: `#stat-review` — Ready to review count
- [ ] TEST: `#stat-review-unread` — Unread bids sub-label
- [ ] TEST: `#stat-awarded` — Awarded deals
- [ ] TEST: `#stat-cancelled` — Cancelled RFQs
- [ ] ✓ Widget counts match DB
- [ ] ✓ Widget click filters list correctly

#### Search & Filter
- [ ] TEST: `#search-input` — real-time search by name/vendor/RFQ#
- [ ] ✓ Filter pills: Active, Ready to Review (Unread), Awarded, Cancelled, Draft
- [ ] ✓ Only one filter active at a time
- [ ] ✓ Empty state shown when no RFQs match

#### RFQ List
- [ ] TEST: `#rfq-list` — list container
- [ ] TEST: `#empty-state` — "no RFQs" message
- [ ] TEST: `#pagination` / `#pagination-label` — pagination
- [ ] Each `.rfq-card`:
  - [ ] Title, status badge (`.status-badge`), vendor list, bid count, deadline, strategy tag
  - [ ] Badge colors: ACTIVE (blue), REVIEW (gold), AWARDED (green), DRAFT (gray), CANCELLED (red)
  - [ ] `.rfq-card.has-new` — "NEW BIDS" badge for unread bids
  - [ ] ✓ Cards clickable — expand inline panels
  - [ ] ✓ Awarded/cancelled cards appear dimmed

#### BOM & Bids Expand
- [ ] `.expand-tab` buttons — BOM and Bids tabs
- [ ] `#tab-bom-{rfqId}` / `#tab-bids-{rfqId}` — tab buttons
- [ ] `#bid-expand-inner-{rfqId}` — expanded content area
- [ ] `.expand-chevron-btn` — expand/collapse chevron
- [ ] `.bom-table` — SKU table in BOM view
- [ ] `.bid-expand-panel` — bids list in Bids view
- [ ] ✓ BOM tab renders SKU data (vendor, part, quantity, description)
- [ ] ✓ Bids tab shows bid prices + reseller names
- [ ] ✓ Switch between tabs works
- [ ] ✓ Clicking card again closes expand

#### RFQ Detail Drawer
- [ ] TEST: `#drawer-overlay` — backdrop (click to close)
- [ ] TEST: `#drawer` — panel
- [ ] TEST: `#drawer-title` — RFQ title
- [ ] TEST: `#drawer-body` — full RFQ content
- [ ] Drawer action buttons by status:
  - [ ] Active: Compare bids, Edit RFQ (`#edit-modal`), Extend deadline, Message resellers, Cancel RFQ (`#cancel-modal`), Duplicate
  - [ ] Awarded: View award, Exec summary link, Duplicate
  - [ ] Draft: Continue editing, Delete draft, Duplicate
- [ ] TEST: `#edit-modal` — edit modal (title, notes, deadline, location, vendors/SKUs)
- [ ] TEST: `#cancel-modal` — cancel modal with reason radio buttons
- [ ] ✓ Drawer loads full content (not spinner)
- [ ] ✓ Drawer shows Vendors & SKUs with line items
- [ ] ✓ Awarded RFQ drawer shows winner block with unit price and line total
- [ ] ✓ Split bid awarded drawer shows per-vendor award blocks
- [ ] ✓ Drawer closes on overlay click
- [ ] ✓ "Ready to Review" unread logic marks as read when drawer opened

---

### B4 — Compare Bids (`bidbridge-compare-bids_1.html`)

#### RFQ Rail (Left Sidebar)
- [ ] TEST: `#rfq-rail-list` — scrollable RFQ list
- [ ] Each `.rfq-rail-item`: title (truncated), status badge, bid count, deadline
- [ ] Active item highlighted
- [ ] ✓ Clicking rail item navigates to that RFQ (?rfq= param)
- [ ] ✓ Draft and cancelled RFQs filtered out of rail

#### RFQ Summary Header
- [ ] TEST: `#rfq-ref` — RFQ ID reference
- [ ] TEST: `#rfq-title` — full title
- [ ] TEST: `#rfq-vendors` — vendor list
- [ ] TEST: `#rfq-qty` — total quantity
- [ ] TEST: `#rfq-location` — HQ location
- [ ] TEST: `#rfq-tier` — minimum tier requirement
- [ ] TEST: `#rfq-deadline` — deadline with color-coded badge (red=urgent, orange=soon, green=ok)
- [ ] TEST: `#rfq-strategy` — strategy badge (🤝 Sole source / ⚖️ Split bid)

#### Cancelled Banner
- [ ] TEST: `#cancelled-banner` — warning banner (hidden unless cancelled)
- [ ] TEST: `#cancelled-banner-reason` — cancellation reason

#### Broadcast Bar
- [ ] TEST: `.broadcast-bar` — always visible
- [ ] "Broadcast message" button → opens broadcast panel
- [ ] ✓ Broadcast bar visible

#### Sort Bar
- [ ] TEST: `.sort-bar` (id="sort-bar")
- [ ] Sort pills: Price low→high (default), high→low, Partner tier, Delivery date
- [ ] TEST: `.sort-pill` — all 4 pills
- [ ] TEST: `#bids-count` — bid count label
- [ ] ✓ Default sort is price low→high
- [ ] ✓ All sort options work

#### View Toggle
- [ ] TEST: `.view-toggle`
- [ ] TEST: `#toggle-card` — card view (default)
- [ ] TEST: `#toggle-table` — table view
- [ ] ✓ Card view is default
- [ ] ✓ Switch to table view works
- [ ] ✓ Switch back to card view works

#### Bid Cards (Card View)
- [ ] TEST: `#view-card` / `#bids-grid` — card grid
- [ ] Each `.bid-card`:
  - [ ] `.winner-ribbon` "🏆 Awarded" (if won)
  - [ ] `.lowest-ribbon` "💰 Lowest" (if lowest but not won)
  - [ ] Reseller avatar (initials), name, tier badge
  - [ ] Bid price, savings vs. lowest comparison
  - [ ] Bid notes (if any)
  - [ ] `.btn-award` — Award button (NOT `.btn-award.awarded` for the exec summary button — keep IDs distinct)
  - [ ] `.btn-msg` — Message button
- [ ] ✓ No raw JS objects in rendered text
- [ ] ✓ Award button visible on bid cards

#### Bid Table (Table View)
- [ ] TEST: `#view-table` / `.compare-table`
- [ ] Columns: Rank, Reseller, Vendor price, Savings, Submitted, Actions
- [ ] `.bid-row-summary` — clickable rows
- [ ] `.bid-row-detail` — expandable detail section

#### Award Modal
- [ ] TEST: `#award-overlay` — modal (class `open` when active)
- [ ] TEST: `#award-price` — price display
- [ ] TEST: `.btn-confirm-award` — confirm button
- [ ] TEST: `.btn-cancel` — cancel button
- [ ] ✓ Award modal opens on Award button click
- [ ] ✓ Award modal closes on cancel
- [ ] ✓ Award modal shows correct reseller name and price

#### Introduction Overlay (post-award)
- [ ] TEST: `#intro-overlay` — overlay (hidden until award confirmed)
- [ ] TEST: `#intro-modal-body` — body content
- [ ] ✓ Intro overlay exists in DOM

#### Message Panel
- [ ] TEST: `#msg-overlay` — message panel
- [ ] TEST: `#msg-panel-title` / `#msg-panel-sub` — panel header
- [ ] TEST: `#msg-thread` — message thread history
- [ ] TEST: `#msg-input` — compose textarea
- [ ] TEST: `.btn-send` — send button
- [ ] TEST: `.msg-close` — close button
- [ ] Tabs: "Direct message" + "📢 All resellers" (broadcast)
- [ ] ✓ Messages panel opens and loads threads
- [ ] ✓ RFQ group headers appear (accordion)
- [ ] ✓ Clicking thread opens conversation
- [ ] ✓ Send button present for direct threads

---

### B5 — Executive Summary (`bidbridge-exec-summary.html`)

#### Toolbar
- [ ] TEST: `.btn-back` — back to My RFQs
- [ ] TEST: `.toolbar-logo` — logo
- [ ] TEST: `.btn-print` — print button
- [ ] ✓ Toolbar and print button visible
- [ ] ✓ Toolbar hidden on print (CSS)

#### Document Header
- [ ] TEST: `.doc-header`, `.doc-logo`, `.doc-meta`
- [ ] Generated date, prepared for (buyer name + company)

#### Title Block
- [ ] TEST: `.doc-title-block`, `.doc-eyebrow`, `.doc-title`, `.doc-subtitle`
- [ ] ✓ RFQ title loaded from DB
- [ ] ✓ Subtitle shows bid count and days on market

#### Thank You Card
- [ ] TEST: `.thank-you-card`
- [ ] Personalized greeting + savings message

#### Market Activity Stats
- [ ] TEST: `.stat-grid`, `.stat-box`, `.stat-box-label`, `.stat-box-value`
- [ ] Stats: Days on market, Bids received, Highest bid (or Awarded value for split)
- [ ] Sole source only: Highest, Average, Lowest, Awarded price boxes
- [ ] ✓ Market activity stats show real data

#### Bid Breakdown
- [ ] TEST: `.bid-table`, `.bid-table th`, `.bid-table tr`
- [ ] TEST: `.winner-row` — winner highlighted with green background
- [ ] TEST: `.winner-badge` — "✓ Awarded" badge
- [ ] Sole source: single table (all resellers, ranked by price)
- [ ] Split bid: per-vendor sections with award status badges
- [ ] ✓ Winner row highlighted
- [ ] ✓ Split bid shows per-vendor sections

#### Savings Section
- [ ] TEST: `.savings-grid`, `.savings-box`, `.savings-box-value`
- [ ] Total saved vs. highest bid ($ amount + %)
- [ ] Split only: Vendor categories independently awarded count
- [ ] ✓ Savings section shown only when savings > 0
- [ ] ✓ "Awarded at market ceiling" section shown when no savings

#### Footer
- [ ] TEST: `.doc-footer`, `.doc-footer-left`, `.doc-footer-right`
- [ ] Company name, confidentiality notice, generated date, RFQ ID

#### Error States
- [ ] ✓ Error shown for missing rfq param
- [ ] ✓ Error shown for RFQ not found
- [ ] ✓ Error shown for wrong buyer (access denied)
- [ ] ✓ Error shown for no bids

---

## CROSS-CUTTING REQUIREMENTS

### Authentication
- [ ] Auth guard on every page → redirects to `bidbridge-auth_1.html` if no session
- [ ] User profile loads on init (avatar, name, role, company)
- [ ] Sign out button clears session, redirects to auth

### RFQ Status Lifecycle
All statuses must display correctly and drive correct UI behavior:
- [ ] **DRAFT** — gray badge, can edit/delete/submit
- [ ] **ACTIVE** — blue badge, accepting bids, can compare/award/cancel/extend
- [ ] **REVIEW** — gold badge, has unread bids, "NEW BIDS" badge, "Ready to review" stat
- [ ] **AWARDED** — green badge, winner shown, dimmed cards, exec summary link
- [ ] **CANCELLED** — red badge, cancellation banner on compare-bids, no award buttons
- [ ] **CLOSED** — treated same as awarded/cancelled

### Split Bid vs. Sole Source
- [ ] ✓ Split bid RFQs show per-vendor sections everywhere (my-rfqs drawer, compare-bids, exec-summary)
- [ ] ✓ Split bid awards: multiple winners possible (one per vendor)
- [ ] ✓ Reseller split bid wins show only awarded vendor's line items
- [ ] ✓ Exec summary per-vendor sections for split bids
- [ ] ✓ Strategy badge shows 🤝 or ⚖️ throughout

### Messaging System
- [ ] ✓ Buyer can message specific reseller (direct)
- [ ] ✓ Buyer can broadcast to all resellers on an RFQ
- [ ] ✓ Reseller can message buyer
- [ ] ✓ Thread marks as read when opened
- [ ] ✓ Unread badge shown on nav item and thread

### Notifications
- [ ] ✓ Resellers notified when new RFQ posted (matching vendors)
- [ ] ✓ Buyers notified when bid received
- [ ] ✓ Read/unread state persists (localStorage or DB)
- [ ] ✓ Mark all read clears all unread states

### Loading & Error States
- [ ] ✓ Loading spinner while data fetches
- [ ] ✓ Empty states when no data
- [ ] ✓ No JS errors on any page
- [ ] ✓ No "[object Object]" or "undefined" in rendered text

### Data Accuracy
- [ ] ✓ All prices formatted correctly ($X,XXX.XX)
- [ ] ✓ Dates formatted consistently
- [ ] ✓ Stat counts match actual DB data
- [ ] ✓ Split-bid vendor_awards correctly attributed
- [ ] ✓ Exec summary savings calculations correct

---

## REDESIGN RULES (non-negotiable)

1. **Every element ID listed with TEST: prefix must exist in the new HTML** — tests will break without them
2. **All JavaScript logic stays unchanged** — only HTML structure and CSS changes
3. **New light theme variables** replace dark navy palette (see bidbridge-reseller-v2.html for reference)
4. **Two-pane layout** where applicable (dashboard, compare bids) — inline forms, no modals where possible
5. **Run relevant Playwright tests after each page** — don't move to next page with failing tests
6. **Check for JS errors** (`page.on('pageerror')`) on every redesigned page

---
*Total: ~200 features, ~150 test-referenced element IDs, 8 pages to redesign*
