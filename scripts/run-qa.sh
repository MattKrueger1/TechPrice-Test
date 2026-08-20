#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  IT Pricing Network — Full QA + UX Inspection Runner
#
#  Usage:
#    ./scripts/run-qa.sh              # QA tests only
#    ./scripts/run-qa.sh --ux         # QA + AI UX inspection
#    ./scripts/run-qa.sh --ux-only    # AI UX inspection only
#
#  For AI UX inspection, set your Anthropic API key first:
#    export ANTHROPIC_API_KEY=sk-ant-...
# ─────────────────────────────────────────────────────────────────

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_UX=false
UX_ONLY=false

for arg in "$@"; do
  case $arg in
    --ux)      RUN_UX=true  ;;
    --ux-only) UX_ONLY=true ;;
  esac
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  IT Pricing Network — QA Suite"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Check dev server ──────────────────────────────────────────
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
  echo "⚠️  Dev server not running. Starting it..."
  npx serve . -p 3000 &>/tmp/serve-qa.log &
  SERVE_PID=$!
  sleep 3
  echo "   Started (PID $SERVE_PID)"
else
  echo "✓ Dev server running"
  SERVE_PID=""
fi
echo ""

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=""

run_suite() {
  local name="$1"
  local files="${@:2}"
  echo "▶ Running: $name"
  if npx playwright test $files --reporter=line 2>&1; then
    echo "  ✅ PASSED"
    PASS_COUNT=$((PASS_COUNT + 1))
    RESULTS="$RESULTS\n✅ $name"
  else
    echo "  ❌ FAILED"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    RESULTS="$RESULTS\n❌ $name"
  fi
  echo ""
}

if [ "$UX_ONLY" = false ]; then

  echo "══════════════════════════════════════════════════════"
  echo "  PHASE 1: Reseller E2E Journey"
  echo "══════════════════════════════════════════════════════"
  run_suite "Reseller Journey (soup to nuts)" tests/e2e-reseller-journey.spec.js

  echo "══════════════════════════════════════════════════════"
  echo "  PHASE 2: Buyer E2E Journey"
  echo "══════════════════════════════════════════════════════"
  run_suite "Buyer Journey (soup to nuts)" tests/e2e-buyer-journey.spec.js

  echo "══════════════════════════════════════════════════════"
  echo "  PHASE 3: Combined Buyer + Reseller Lifecycle"
  echo "══════════════════════════════════════════════════════"
  run_suite "Combined Lifecycle (RFQ → bid → award → message)" tests/e2e-combined-lifecycle.spec.js

  echo "══════════════════════════════════════════════════════"
  echo "  PHASE 4: Core Regression Suite"
  echo "══════════════════════════════════════════════════════"
  run_suite "Reseller regression" tests/reseller.spec.js
  run_suite "Compare bids" tests/compare-bids.spec.js
  run_suite "My RFQs widgets" tests/my-rfqs-widgets-seeded.spec.js
  run_suite "Exec summary" tests/exec-summary.spec.js
  run_suite "Messaging" tests/messaging.spec.js
  run_suite "Notifications" tests/notifications-read-state.spec.js
  run_suite "Widget consistency" tests/widget-consistency.spec.js

fi

if [ "$RUN_UX" = true ] || [ "$UX_ONLY" = true ]; then

  echo "══════════════════════════════════════════════════════"
  echo "  PHASE 5: AI UX Inspection"
  echo "══════════════════════════════════════════════════════"
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "  ⚠️  ANTHROPIC_API_KEY not set"
    echo "     Screenshots will be taken but AI analysis requires the key."
    echo "     Set it with: export ANTHROPIC_API_KEY=sk-ant-..."
    echo ""
  fi

  echo "▶ Running: AI UX Inspector (all screens, both personas)"
  if npx playwright test tests/ux-inspector.spec.js --reporter=line 2>&1; then
    echo "  ✅ UX inspection complete"
    RESULTS="$RESULTS\n✅ AI UX Inspection"
    if [ -f "ux-report/ux-report.html" ]; then
      echo ""
      echo "  📊 Opening UX report..."
      open "ux-report/ux-report.html" 2>/dev/null || echo "  Report saved to: ux-report/ux-report.html"
    fi
  else
    echo "  ❌ UX inspection failed"
    RESULTS="$RESULTS\n❌ AI UX Inspection"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  echo ""

fi

# ── Summary ───────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "$RESULTS"
echo ""
if [ $FAIL_COUNT -eq 0 ]; then
  echo "  🎉 All suites passed!"
else
  echo "  ⚠️  $FAIL_COUNT suite(s) failed — check output above"
fi
echo ""
echo "  Completed: $(date '+%H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Clean up server if we started it
if [ -n "$SERVE_PID" ]; then
  kill $SERVE_PID 2>/dev/null || true
fi

exit $FAIL_COUNT
