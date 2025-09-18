#!/usr/bin/env bash
set -euo pipefail

# Validate expected Docker MCP configuration files
CATALOG_DIR="${MCP_CATALOG_DIR:-$HOME/.docker/mcp/catalogs}"
WORD_FLUX_CATALOG_PATH="${MCP_WORDFLUX_CATALOG:-$CATALOG_DIR/wordflux.yaml}"
REGISTRY_PATH="${MCP_REGISTRY_PATH:-$HOME/.docker/mcp/registry.yaml}"

if [[ ! -f "$WORD_FLUX_CATALOG_PATH" ]]; then
  echo "[mcp-gateway] Missing WordFlux catalog at $WORD_FLUX_CATALOG_PATH" >&2
  echo "Run 'docker mcp catalog import /path/to/wordflux.yaml' first." >&2
  exit 1
fi

if [[ ! -f "$REGISTRY_PATH" ]]; then
  echo "[mcp-gateway] Missing registry at $REGISTRY_PATH" >&2
  echo "Enable the TaskCafe server via 'docker mcp server enable taskcafe'." >&2
  exit 1
fi

PORT="${MCP_GATEWAY_PORT:-8811}"

if ! docker mcp --help >/dev/null 2>&1; then
  echo "[mcp-gateway] Docker MCP plugin not available. Install Docker Desktop >= 4.30 or the standalone MCP toolkit." >&2
  exit 1
fi

CMD=(docker mcp gateway run \
  --transport sse \
  --port "$PORT")

exec "${CMD[@]}"
