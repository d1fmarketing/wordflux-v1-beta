#!/bin/bash

# Get login token
LOGIN_RESPONSE=$(curl -s -X POST http://52.4.68.118:3333/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { login(input: {username: \"admin\", password: \"admin123\"}) { accessToken } }"
  }')

echo "Login response: $LOGIN_RESPONSE"
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.login.accessToken')

echo "Token: $TOKEN"

# Try to add comment with correct field name
curl -X POST http://52.4.68.118:3333/graphql \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=$TOKEN" \
  -d '{
    "query": "mutation ($input: CreateTaskComment!) { createTaskComment(input: $input) { comment { id } } }",
    "variables": {
      "input": {
        "taskID": "798d5d9d-5fd5-461e-a35c-1d649711b6f1",
        "message": "Test comment"
      }
    }
  }' | jq