#!/bin/bash
# Setup implementation plan for current feature

set -e

# Parse arguments
if [ "$1" != "--json" ]; then
    echo "Usage: $0 --json"
    exit 1
fi

# Get current branch
BRANCH=$(git branch --show-current)

# Find most recent spec file
SPECS_DIR="/home/ubuntu/wordflux-v1-beta/specs"
FEATURE_SPEC=$(ls -t "$SPECS_DIR"/*.md 2>/dev/null | head -1)

if [ -z "$FEATURE_SPEC" ]; then
    echo "Error: No specification file found in $SPECS_DIR"
    exit 1
fi

# Create implementation plan path
SPEC_NAME=$(basename "$FEATURE_SPEC" .md)
IMPL_PLAN="$SPECS_DIR/${SPEC_NAME}-plan.md"

# Copy plan template if it doesn't exist
if [ ! -f "$IMPL_PLAN" ]; then
    if [ -f "/home/ubuntu/wordflux-v1-beta/templates/plan-template.md" ]; then
        cp "/home/ubuntu/wordflux-v1-beta/templates/plan-template.md" "$IMPL_PLAN"
    else
        touch "$IMPL_PLAN"
    fi
fi

# Output JSON
echo "{\"FEATURE_SPEC\": \"$FEATURE_SPEC\", \"IMPL_PLAN\": \"$IMPL_PLAN\", \"SPECS_DIR\": \"$SPECS_DIR\", \"BRANCH\": \"$BRANCH\"}"