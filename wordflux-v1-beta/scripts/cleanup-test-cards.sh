#!/bin/bash

# Test card IDs to remove
test_cards=(
  140 139 124 120 117 8 125 116 115 114
  138 137 136 135 134 133 132 131 130 129 128 127
)

echo "Removing ${#test_cards[@]} test cards..."

for id in "${test_cards[@]}"; do
  echo "Removing test card #$id"

  # Send remove command to chat API
  curl -s -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"remove #$id\"}" | jq -r '.response'

  sleep 0.5  # Small delay to avoid overwhelming the API
done

echo "Done! All test cards should be removed."