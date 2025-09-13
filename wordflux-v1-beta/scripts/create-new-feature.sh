#!/bin/bash
# Create new feature branch and spec file

set -e

# Parse arguments
if [ "$1" != "--json" ] || [ -z "$2" ]; then
    echo "Usage: $0 --json \"feature description\""
    exit 1
fi

FEATURE_DESC="$2"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Generate branch name from description
BRANCH_NAME=$(echo "$FEATURE_DESC" | \
    tr '[:upper:]' '[:lower:]' | \
    sed 's/[^a-z0-9]/-/g' | \
    sed 's/--*/-/g' | \
    sed 's/^-//' | \
    sed 's/-$//' | \
    cut -c1-50)
BRANCH_NAME="feature/${BRANCH_NAME}-${TIMESTAMP}"

# Create spec file path
SPEC_FILE="/home/ubuntu/wordflux-v1-beta/specs/${BRANCH_NAME##*/}.md"

# Create specs directory if it doesn't exist
mkdir -p /home/ubuntu/wordflux-v1-beta/specs

# Create and checkout new branch
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

# Initialize spec file
touch "$SPEC_FILE"

# Output JSON
echo "{\"BRANCH_NAME\": \"$BRANCH_NAME\", \"SPEC_FILE\": \"$SPEC_FILE\"}"