#!/bin/bash

# ========================================
# SKELETON ELIMINATION TEST SUITE v110
# ========================================
# Comprehensive testing to ensure 100% skeleton-free deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 SKELETON ELIMINATION TEST SUITE v110${NC}"
echo "========================================="
echo ""

TOTAL_TESTS=0
PASSED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Test $TOTAL_TESTS: $test_name... "

    if eval "$test_command"; then
        if [ "$expected_result" = "pass" ]; then
            echo -e "${GREEN}✅ PASS${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}❌ FAIL (expected to fail)${NC}"
        fi
    else
        if [ "$expected_result" = "fail" ]; then
            echo -e "${GREEN}✅ PASS (correctly failed)${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}❌ FAIL${NC}"
        fi
    fi
}

# Test 1: Check source files for skeleton components
echo -e "${YELLOW}Phase 1: Source Code Analysis${NC}"
echo "--------------------------------"
run_test "No Skeleton component files" \
    "! ls app/components/Skeleton* 2>/dev/null | grep -q ." \
    "pass"

run_test "No skeleton imports in components" \
    "! grep -r \"import.*Skeleton\" app/components/*.tsx 2>/dev/null | grep -v skeleton-killer | grep -q ." \
    "pass"

run_test "No shimmer class definitions" \
    "! grep -r \"className.*shimmer\" app/components/*.tsx 2>/dev/null | grep -v skeleton-killer | grep -q ." \
    "pass"

# Test 2: Check CSS files
echo ""
echo -e "${YELLOW}Phase 2: CSS Analysis${NC}"
echo "----------------------"
run_test "CSS has defensive rules" \
    "grep -q 'skeleton.*display.*none' app/globals.css" \
    "pass"

run_test "No striped gradients" \
    "! grep -r 'repeating-linear-gradient' app/*.css app/components/*.css 2>/dev/null | grep -q ." \
    "pass"

run_test "BoardColumn has nuclear defenses" \
    "grep -q 'NUCLEAR DEFENSE' app/components/BoardColumn.module.css 2>/dev/null || grep -q 'skeleton.*display.*none' app/components/BoardColumn.module.css 2>/dev/null" \
    "pass"

# Test 3: Check built files
echo ""
echo -e "${YELLOW}Phase 3: Build Analysis${NC}"
echo "-----------------------"
if [ -d ".next" ]; then
    run_test "Built CSS contains defenses" \
        "grep -q 'skeleton.*display.*none\|left:-999' .next/static/css/*.css 2>/dev/null" \
        "pass"

    run_test "No active shimmer animations" \
        "! grep '@keyframes shimmer' .next/static/css/*.css 2>/dev/null | grep -v 'transform.*none' | grep -q ." \
        "pass"
else
    echo -e "${YELLOW}⚠️  Build directory not found. Run 'npm run build' first.${NC}"
fi

# Test 4: Runtime checks
echo ""
echo -e "${YELLOW}Phase 4: Runtime Analysis${NC}"
echo "------------------------"
PORT=$(pm2 list --no-color | grep wordflux | awk '{print $13}' | grep -o '[0-9]*' | head -1)
PORT=${PORT:-3001}
URL="http://localhost:$PORT"

run_test "Service is running" \
    "curl -s -o /dev/null -w '%{http_code}' $URL/api/health | grep -q '200'" \
    "pass"

run_test "Skeleton killer script present" \
    "curl -s $URL/workspace | grep -q 'skeleton-killer'" \
    "pass"

run_test "No skeleton classes in DOM" \
    "! curl -s $URL/workspace | grep -o 'class=\"[^\"]*\"' | grep -i 'skeleton\|shimmer' | grep -q ." \
    "pass"

run_test "No loading text stuck" \
    "! curl -s $URL/workspace | grep -q 'Carregando'" \
    "pass"

# Test 5: JavaScript verification
echo ""
echo -e "${YELLOW}Phase 5: JavaScript Defense${NC}"
echo "---------------------------"
run_test "Triple-method killer present" \
    "grep -q 'executeTripleKill\|triple.*method\|triple.*defense' app/layout.tsx 2>/dev/null" \
    "pass"

run_test "MutationObserver active" \
    "grep -q 'MutationObserver' app/layout.tsx" \
    "pass"

run_test "Style injection present" \
    "grep -q 'skeleton-killer-styles' app/layout.tsx" \
    "pass"

# Test 6: Data attributes
echo ""
echo -e "${YELLOW}Phase 6: Component Attributes${NC}"
echo "----------------------------"
run_test "BoardColumn has data-no-skeleton" \
    "grep -q 'data-no-skeleton' app/components/BoardColumn.tsx" \
    "pass"

run_test "TaskCard has data-no-skeleton" \
    "grep -q 'data-no-skeleton' app/components/TaskCard.tsx" \
    "pass"

# Test 7: Visual test (if playwright available)
echo ""
echo -e "${YELLOW}Phase 7: Visual Testing${NC}"
echo "----------------------"
if command -v npx &> /dev/null && npx playwright --version &> /dev/null 2>&1; then
    run_test "Screenshot capture" \
        "npx playwright screenshot $URL/workspace /tmp/skeleton-test.png --timeout=10000 &>/dev/null" \
        "pass"

    echo "Screenshot saved to /tmp/skeleton-test.png"
    echo "Please manually verify: NO striped overlays visible"
else
    echo -e "${YELLOW}⚠️  Playwright not available for visual testing${NC}"
fi

# Test 8: Performance test
echo ""
echo -e "${YELLOW}Phase 8: Performance${NC}"
echo "-------------------"
LOAD_TIME=$(curl -w "%{time_total}" -o /dev/null -s $URL/workspace)
echo "Page load time: ${LOAD_TIME}s"
run_test "Load time < 3 seconds" \
    "[ $(echo \"$LOAD_TIME < 3\" | bc -l) -eq 1 ]" \
    "pass"

# Test 9: Cache headers
echo ""
echo -e "${YELLOW}Phase 9: Cache Control${NC}"
echo "---------------------"
run_test "HTML not cached" \
    "curl -I $URL/workspace 2>/dev/null | grep -i cache-control | grep -q 'no-cache\|no-store\|must-revalidate'" \
    "pass"

# Final report
echo ""
echo "========================================="
echo -e "${YELLOW}FINAL REPORT${NC}"
echo "========================================="
echo "Tests Passed: $PASSED_TESTS / $TOTAL_TESTS"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}🛡️  Skeleton defenses are 100% operational${NC}"
    exit 0
else
    FAILED=$((TOTAL_TESTS - PASSED_TESTS))
    echo -e "${RED}❌ $FAILED tests failed${NC}"
    echo -e "${RED}⚠️  Fix issues before deploying!${NC}"
    exit 1
fi