#!/bin/bash
# ────────────────────────────────────────────────────────────────
#  BIDDING WAR SIMULATION
#
#  Creates a multi-vendor RFQ + 10 fake reseller companies + a
#  4-round bidding war with 15+ price revisions.
#
#  Buyer:    mattkrueger@comcast.net  (log in to see the results)
#  Cleanup:  ./scripts/simulate-bidding-war.sh cleanup
# ────────────────────────────────────────────────────────────────
set -e

SERVICE_KEY="${SUPABASE_SERVICE_KEY:-}"
BASE="https://kgejpzjoiewrgwzixcaa.supabase.co"

if [ -z "$SERVICE_KEY" ]; then
  echo "ERROR: SUPABASE_SERVICE_KEY not set."
  echo "Run: export SUPABASE_SERVICE_KEY=<your-secret-key>"
  exit 1
fi
BUYER_ID="46ea832d-5c57-4570-955b-50438f634d8c"
MARKER="Bidding war simulation — 10 resellers"

api() {
  local method="$1" path="$2" body="$3"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$BASE$path" \
      -H "Content-Type: application/json" \
      -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
      -H "Prefer: return=representation" \
      -d "$body"
  else
    curl -s -X "$method" "$BASE$path" \
      -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
  fi
}

# ── CLEANUP MODE ──────────────────────────────────────────────
if [ "$1" = "cleanup" ]; then
  echo "🧹 Cleaning up bidding-war simulation data…"

  # URL-encode the marker for the notes filter
  MARKER_ENCODED=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$MARKER'))")

  # Delete simulation RFQ and dependent rows
  RFQ_IDS=$(api GET "/rest/v1/rfqs?notes=eq.$MARKER_ENCODED&select=id" | python3 -c "import json,sys
try: d = json.load(sys.stdin); print(','.join(r['id'] for r in d))
except: print('')")
  if [ -n "$RFQ_IDS" ]; then
    for T in bid_history bids notifications messages rfq_items; do
      api DELETE "/rest/v1/$T?rfq_id=in.($RFQ_IDS)" > /dev/null
    done
    api DELETE "/rest/v1/rfqs?id=in.($RFQ_IDS)" > /dev/null
  fi

  # Delete simulated reseller accounts
  SIM_USERS=$(api GET "/auth/v1/admin/users?per_page=200" | python3 -c "
import json,sys
try:
  data = json.load(sys.stdin)
  users = data.get('users', [])
  sim = [u for u in users if 'sim-reseller-' in u.get('email','')]
  print(' '.join(u['id'] for u in sim))
except: print('')
")
  COUNT=0
  for uid in $SIM_USERS; do
    [ -z "$uid" ] && continue
    api DELETE "/rest/v1/reseller_vendors?reseller_id=eq.$uid" > /dev/null
    api DELETE "/rest/v1/reseller_profiles?id=eq.$uid" > /dev/null
    api DELETE "/auth/v1/admin/users/$uid" > /dev/null
    COUNT=$((COUNT+1))
  done
  echo "✅ Cleanup complete — deleted $COUNT reseller accounts"
  exit 0
fi

echo "🏁 Building bidding-war simulation…"
echo ""

# ── 10 RESELLER COMPANIES ─────────────────────────────────────
RESELLERS_NAMES=(
  "Techbridge Solutions|Cisco,Dell Technologies,Palo Alto Networks"
  "NetPath Systems|Cisco,Palo Alto Networks"
  "IT Advantage Group|Dell Technologies"
  "ProServe Technologies|Cisco,Dell Technologies"
  "Enterprise Networks Inc|Cisco,Palo Alto Networks"
  "Datacom Partners|Dell Technologies,Palo Alto Networks"
  "SecureIT Consulting|Palo Alto Networks"
  "RackSpace Solutions|Cisco,Dell Technologies"
  "Netbridge Systems|Cisco,Dell Technologies,Palo Alto Networks"
  "TechCore Inc|Cisco"
)

TS=$(date +%s)
declare -a RESELLER_IDS
declare -a RESELLER_COMPANIES
declare -a RESELLER_VENDORS

echo "👥 Creating 10 reseller accounts…"
for i in "${!RESELLERS_NAMES[@]}"; do
  IFS='|' read -r company vendors <<< "${RESELLERS_NAMES[$i]}"
  slug=$(echo "$company" | tr '[:upper:] ' '[:lower:]-' | tr -d '.,')
  email="sim-reseller-$slug-$TS@test-itpn.com"

  # Create auth user
  uid=$(api POST "/auth/v1/admin/users" \
    "{\"email\":\"$email\",\"password\":\"SimTest123!\",\"email_confirm\":true}" \
    | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))")

  if [ -z "$uid" ]; then echo "  ⚠ Failed to create $company"; continue; fi

  # Create reseller_profile (upsert-style: if trigger auto-created one, PATCH it)
  api PATCH "/rest/v1/reseller_profiles?id=eq.$uid" \
    "{\"company\":\"$company\",\"status\":\"approved\",\"contact_first\":\"Sim\",\"contact_last\":\"Rep-$((i+1))\",\"company_hq\":\"Simulated, TX\"}" > /dev/null
  # If PATCH matched 0 rows, insert
  api POST "/rest/v1/reseller_profiles" \
    "{\"id\":\"$uid\",\"company\":\"$company\",\"status\":\"approved\",\"contact_first\":\"Sim\",\"contact_last\":\"Rep-$((i+1))\",\"company_hq\":\"Simulated, TX\"}" > /dev/null 2>&1 || true

  # Attach vendor authorizations
  IFS=',' read -ra VLIST <<< "$vendors"
  for v in "${VLIST[@]}"; do
    api POST "/rest/v1/reseller_vendors" \
      "{\"reseller_id\":\"$uid\",\"vendor\":\"$v\",\"tier\":\"gold\",\"verified\":true}" > /dev/null
  done

  RESELLER_IDS+=("$uid")
  RESELLER_COMPANIES+=("$company")
  RESELLER_VENDORS+=("$vendors")
  echo "  ✓ $company (vendors: $vendors)"
done

# ── CREATE MULTI-VENDOR RFQ ───────────────────────────────────
echo ""
echo "📋 Creating multi-vendor RFQ…"

DEADLINE=$(date -j -v+14d +%Y-%m-%d 2>/dev/null || date -d "+14 days" +%Y-%m-%d)
RFQ_RESP=$(api POST "/rest/v1/rfqs" "{
  \"buyer_id\":\"$BUYER_ID\",
  \"title\":\"Multi-vendor enterprise refresh — Cisco + Dell + Palo Alto\",
  \"status\":\"active\",
  \"strategy\":\"split\",
  \"hq_location\":\"Austin, TX\",
  \"deadline\":\"$DEADLINE\",
  \"notes\":\"$MARKER\"
}")
RFQ_ID=$(echo "$RFQ_RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
echo "  RFQ ID: $RFQ_ID"

# Line items — Cisco 24 switches, Dell 6 servers, Palo Alto 4 firewalls
api POST "/rest/v1/rfq_items" "{\"rfq_id\":\"$RFQ_ID\",\"vendor\":\"Cisco\",\"sku\":\"C9200-48P-A\",\"quantity\":24,\"description\":\"Cisco Catalyst 9200 48-port PoE switch\"}" > /dev/null
api POST "/rest/v1/rfq_items" "{\"rfq_id\":\"$RFQ_ID\",\"vendor\":\"Dell Technologies\",\"sku\":\"PE-R750\",\"quantity\":6,\"description\":\"Dell PowerEdge R750 server\"}" > /dev/null
api POST "/rest/v1/rfq_items" "{\"rfq_id\":\"$RFQ_ID\",\"vendor\":\"Palo Alto Networks\",\"sku\":\"PA-3410\",\"quantity\":4,\"description\":\"Palo Alto Networks PA-3410 firewall\"}" > /dev/null

# ── BID SIMULATION HELPER ─────────────────────────────────────
# Places or revises a bid, writes bid_history, and sends buyer + competitor notifications
place_bid() {
  local reseller_id="$1" company="$2" total_price="$3" line_items_json="$4" is_revision="$5" prior_price="$6"

  # Upsert bid
  local existing=$(api GET "/rest/v1/bids?rfq_id=eq.$RFQ_ID&reseller_id=eq.$reseller_id&select=id")
  local bid_id
  if echo "$existing" | grep -q '"id"'; then
    bid_id=$(echo "$existing" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
    api PATCH "/rest/v1/bids?id=eq.$bid_id" \
      "{\"total_price\":$total_price,\"line_items\":$line_items_json,\"status\":\"pending\"}" > /dev/null
  else
    local created=$(api POST "/rest/v1/bids" \
      "{\"rfq_id\":\"$RFQ_ID\",\"reseller_id\":\"$reseller_id\",\"total_price\":$total_price,\"status\":\"pending\",\"line_items\":$line_items_json}")
    bid_id=$(echo "$created" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
  fi

  # Write bid_history row (this is what powers the Price Trajectory)
  api POST "/rest/v1/bid_history" \
    "{\"bid_id\":\"$bid_id\",\"rfq_id\":\"$RFQ_ID\",\"reseller_id\":\"$reseller_id\",\"total_price\":$total_price,\"line_items\":$line_items_json}" > /dev/null

  # Notify buyer
  local buyer_msg
  if [ "$is_revision" = "true" ]; then
    local delta=$(python3 -c "print(int($prior_price - $total_price))")
    if [ "$delta" -gt 0 ]; then
      buyer_msg="$company dropped their bid on the multi-vendor RFQ (−\$$(printf "%'d" $delta))"
    else
      buyer_msg="$company revised their bid on the multi-vendor RFQ"
    fi
    api POST "/rest/v1/notifications" \
      "{\"user_id\":\"$BUYER_ID\",\"type\":\"bid_revised\",\"message\":\"$buyer_msg\",\"rfq_id\":\"$RFQ_ID\",\"read\":false}" > /dev/null
  else
    buyer_msg="New bid from $company on multi-vendor RFQ — \$$(printf "%'d" $total_price)"
    api POST "/rest/v1/notifications" \
      "{\"user_id\":\"$BUYER_ID\",\"type\":\"bid_submitted\",\"message\":\"$buyer_msg\",\"rfq_id\":\"$RFQ_ID\",\"read\":false}" > /dev/null
  fi
}

# Generate a Cisco+Dell+Palo Alto line items JSON given a total price (approximate split by product weight)
line_items_json() {
  local total="$1" vendors="$2"
  python3 -c "
total = $total
vendors = '$vendors'.split(',')
# Weighted by rough SKU value: Cisco switches ~40%, Dell servers ~35%, PA firewalls ~25%
weights = {'Cisco': 0.40, 'Dell Technologies': 0.35, 'Palo Alto Networks': 0.25}
skus = {'Cisco': ('C9200-48P-A', 24), 'Dell Technologies': ('PE-R750', 6), 'Palo Alto Networks': ('PA-3410', 4)}
mine = [v for v in vendors if v in weights]
mine_wts = {v: weights[v] for v in mine}
scale = sum(mine_wts.values())
lis = []
for v in mine:
  vendor_total = round(total * (mine_wts[v] / scale), 2)
  sku, qty = skus[v]
  unit = round(vendor_total / qty, 2)
  lis.append({'vendor': v, 'sku': sku, 'quantity': qty, 'unit_price': unit, 'line_total': vendor_total})
import json
print(json.dumps(lis))
"
}

# ── ROUND 1: INITIAL BIDS ─────────────────────────────────────
echo ""
echo "💰 Round 1: Initial bids from all 10 resellers…"

# Deliberately spread prices across a range so the buyer sees an interesting comparison
declare -a R1_PRICES=(48000 52000 51000 49500 53500 50500 47000 54000 46500 50000)
declare -a CURRENT_PRICES

for i in "${!RESELLER_IDS[@]}"; do
  uid="${RESELLER_IDS[$i]}"
  company="${RESELLER_COMPANIES[$i]}"
  vendors="${RESELLER_VENDORS[$i]}"
  price="${R1_PRICES[$i]}"
  li=$(line_items_json "$price" "$vendors")
  place_bid "$uid" "$company" "$price" "$li" "false" "0"
  CURRENT_PRICES[$i]="$price"
  echo "  ✓ $company: \$$(printf "%'d" $price)"
done

# ── ROUND 2: 5 RESELLERS DROP PRICES ──────────────────────────
echo ""
echo "💰 Round 2: 5 resellers drop prices to compete for the lead…"

declare -a R2_INDICES=(6 8 0 4 2)   # TechCore, Netbridge, Techbridge, Enterprise, IT Advantage
declare -a R2_DROPS=(3000 2500 4000 5500 3500)

for j in "${!R2_INDICES[@]}"; do
  i="${R2_INDICES[$j]}"
  uid="${RESELLER_IDS[$i]}"
  company="${RESELLER_COMPANIES[$i]}"
  vendors="${RESELLER_VENDORS[$i]}"
  prior="${CURRENT_PRICES[$i]}"
  drop="${R2_DROPS[$j]}"
  new_price=$((prior - drop))
  li=$(line_items_json "$new_price" "$vendors")
  place_bid "$uid" "$company" "$new_price" "$li" "true" "$prior"
  CURRENT_PRICES[$i]="$new_price"
  echo "  ↓ $company: \$$(printf "%'d" $prior) → \$$(printf "%'d" $new_price)"
done

# ── ROUND 3: 3 AGGRESSIVE RESELLERS ────────────────────────────
echo ""
echo "💰 Round 3: 3 aggressive resellers drop further…"

declare -a R3_INDICES=(8 6 0)
declare -a R3_DROPS=(1800 2200 1200)

for j in "${!R3_INDICES[@]}"; do
  i="${R3_INDICES[$j]}"
  uid="${RESELLER_IDS[$i]}"
  company="${RESELLER_COMPANIES[$i]}"
  vendors="${RESELLER_VENDORS[$i]}"
  prior="${CURRENT_PRICES[$i]}"
  drop="${R3_DROPS[$j]}"
  new_price=$((prior - drop))
  li=$(line_items_json "$new_price" "$vendors")
  place_bid "$uid" "$company" "$new_price" "$li" "true" "$prior"
  CURRENT_PRICES[$i]="$new_price"
  echo "  ↓↓ $company: \$$(printf "%'d" $prior) → \$$(printf "%'d" $new_price)"
done

# ── ROUND 4: FINAL PUSH BY THE LEADERS ────────────────────────
echo ""
echo "💰 Round 4: Final push by the leaders…"

declare -a R4_INDICES=(8 6)
declare -a R4_DROPS=(900 500)

for j in "${!R4_INDICES[@]}"; do
  i="${R4_INDICES[$j]}"
  uid="${RESELLER_IDS[$i]}"
  company="${RESELLER_COMPANIES[$i]}"
  vendors="${RESELLER_VENDORS[$i]}"
  prior="${CURRENT_PRICES[$i]}"
  drop="${R4_DROPS[$j]}"
  new_price=$((prior - drop))
  li=$(line_items_json "$new_price" "$vendors")
  place_bid "$uid" "$company" "$new_price" "$li" "true" "$prior"
  CURRENT_PRICES[$i]="$new_price"
  echo "  🏁 $company: \$$(printf "%'d" $prior) → \$$(printf "%'d" $new_price) (WINNING BID)"
done

# ── SUMMARY ───────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 BIDDING WAR COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "RFQ: Multi-vendor enterprise refresh — Cisco + Dell + Palo Alto"
echo ""
echo "Sign in as the buyer to see the results:"
echo "  📧 mattkrueger@comcast.net / Test12345678"
echo "  🌐 http://localhost:3000/bidbridge-my-rfqs.html"
echo ""
echo "You'll see:"
echo "  • 10 bids on the multi-vendor RFQ"
echo "  • Price trajectories for revised bids (up to 4 revisions on some)"
echo "  • Notifications for each bid + revision"
echo ""
echo "To clean up: ./scripts/simulate-bidding-war.sh cleanup"
echo ""
