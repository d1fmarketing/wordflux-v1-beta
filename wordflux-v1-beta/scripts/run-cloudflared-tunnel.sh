#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/wordflux-config.yml}"
TUNNEL_TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:-}"

if [[ -n "$TUNNEL_TOKEN" ]]; then
  exec cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN"
fi

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "[cloudflared] Missing tunnel token and config file at $CONFIG_PATH" >&2
  echo "Provide CLOUDFLARE_TUNNEL_TOKEN or copy infra/cloudflared/config.example.yml." >&2
  exit 1
fi

# Warn if the config references a credentials file that does not exist
CREDS_LINE=$(grep -E '^\s*credentials-file:' "$CONFIG_PATH" || true)
if [[ -n "$CREDS_LINE" ]]; then
  CREDS_PATH=$(echo "$CREDS_LINE" | awk '{print $2}')
  # Expand leading ~ manually
  if [[ "$CREDS_PATH" == ~* ]]; then
    CREDS_PATH="$HOME${CREDS_PATH:1}"
  fi
  if [[ ! -f "$CREDS_PATH" ]]; then
    echo "[cloudflared] credentials-file '$CREDS_PATH' not found. Run 'cloudflared tunnel create wordflux' to generate it or update the path." >&2
    exit 1
  fi
fi

exec cloudflared tunnel --no-autoupdate --config "$CONFIG_PATH" run
