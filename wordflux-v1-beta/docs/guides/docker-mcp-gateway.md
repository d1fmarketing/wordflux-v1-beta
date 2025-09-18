# Docker MCP Gateway: TaskCafe Server Setup

This guide explains how to ship the existing WordFlux TaskCafe MCP server inside a Docker image and expose it through Docker's MCP Gateway. Follow the steps below to add the server to Claude Desktop, Cursor, LM Studio, or any other MCP-aware client.

## 1. Build the TaskCafe MCP image

```bash
cd wordflux-v1-beta/mcp
npm install --omit=dev   # first-time only or when deps change
# npm run build          # optional if you regenerate server.js via tsc
docker build -t taskcafe-mcp .
```

The Dockerfile installs only the MCP runtime dependencies (`@modelcontextprotocol/sdk` and `zod`) and bundles the transpiled `server.js` together with the TaskCafe client helper.

## 2. Store credentials with Docker secrets

```bash
docker mcp secret set TASKCAFE_USERNAME <taskcafe-user>
docker mcp secret set TASKCAFE_PASSWORD <taskcafe-password>
docker mcp secret set TASKCAFE_PROJECT_ID <uuid>   # optional override
docker mcp secret set TASKCAFE_URL http://localhost:3333  # override when not local
```

> Secrets are injected automatically when the gateway starts a server. Keep the credentials out of the catalog file to avoid accidental commits.

## 3. Add a custom catalog entry

Create (or update) `~/.docker/mcp/catalogs/wordflux.yaml` (a ready-to-copy version lives at `mcp/catalog-wordflux.example.yaml`):

```yaml
taskcafe:
  image: taskcafe-mcp:latest
  description: TaskCafe board automation for WordFlux
  env:
    TASKCAFE_URL: ${TASKCAFE_URL:-http://localhost:3333}
  secrets:
    - TASKCAFE_USERNAME
    - TASKCAFE_PASSWORD
    - TASKCAFE_PROJECT_ID
```

The image expects TaskCafe configuration via environment variables. Defaults baked into the MCP server cover local testing, but update the catalog (or Docker MCP config) if you point at a remote TaskCafe instance.

## 4. Import the catalog and enable the server

Tell the Docker MCP plugin about the new catalog, then enable the TaskCafe server:

```bash
docker mcp catalog import ~/.docker/mcp/catalogs/wordflux.yaml
docker mcp server enable taskcafe
```

Use `docker mcp server ls` to confirm the server is active. The plugin manages `~/.docker/mcp/registry.yaml` for you.

## 5. Launch the gateway

Run the gateway locally over SSE so multiple clients can connect:

```bash
docker mcp gateway run --transport sse --port 8811
```

Override `--port` if you already use 8811, then expose the endpoint via your preferred tunnel/proxy for remote clients.

### Automated remote launcher

The repository includes `scripts/run-mcp-gateway-sse.sh`, which wraps the command above with sensible defaults:

```bash
./scripts/run-mcp-gateway-sse.sh
```

The script will verify the expected catalog/registry files exist and start the gateway on port `8811` using SSE transport. It relies on `docker mcp` having the WordFlux catalog imported and `taskcafe` enabled (see step 4).

> **Heads-up:** the launcher requires the Docker MCP plugin (`docker mcp`). Install Docker Desktop 4.30+ or the standalone toolkit on Linux before running.

To keep it running, add the PM2 process defined in `ecosystem.config.js`:

```bash
pm2 start ecosystem.config.js
pm2 save
```

## 6. Wire up your MCP clients

Update the MCP configuration for Claude Desktop, Cursor, LM Studio, etc. so each client points to a single Docker gateway entry. Example (Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "docker-mcp": {
      "command": "docker",
      "args": ["mcp", "gateway", "run", "--transport", "sse", "--port", "8811"]
    }
  }
}
```

Restart the client so it reloads the connection list.

## 7. Verify the TaskCafe tools

1. Start the gateway as shown above.
2. In a separate terminal, hit the gateway directly:
   ```bash
   curl -s -X POST http://localhost:8811/tools/taskcafe/approve_card \
     -H 'Content-Type: application/json' \
     -d '{"arguments": {"search": "Card title"}}'
   ```
3. From Claude or Cursor, list the available tools—`approve_card`, `reject_card`, `needs_work`, `move_card`, `create_card`, and `list_cards` should appear under the Docker MCP section.

If the call fails, check `docker logs` output from the transient container or run the gateway with `--log-level debug` for verbose diagnostics.

## 8. Keeping the image up to date

Whenever you tweak `mcp/server.ts` or `mcp/lib/providers/taskcafe-client.ts`:

1. Rebuild the transpiled output (`npm run build` if you rely on a TypeScript step).
2. Rebuild the Docker image (`docker build -t taskcafe-mcp .`).
3. Restart the gateway so the new image is used for subsequent tool calls.

With this pipeline in place, the TaskCafe MCP server can be shared across every agent via a single Docker MCP Gateway connection, keeping credentials centralized and removing the need for multiple stdio clients running in parallel.

## 9. Optional: expose the gateway securely

To publish the SSE endpoint without opening the firewall, run Cloudflare Tunnel. The repo includes:

 - `infra/cloudflared/config.example.yml` – sample ingress mapping for `localhost:3000` (app) and `localhost:8811` (MCP).
 - `scripts/run-cloudflared-tunnel.sh` – launcher that either consumes a `CLOUDFLARE_TUNNEL_TOKEN` or the config file above.

### Quick start

1. Install `cloudflared` (if not already available).
2. Log in and create a named tunnel:
   ```bash
   cloudflared login              # Opens browser once per account
   cloudflared tunnel create wordflux
   ```
   The second command writes a credentials file such as `~/.cloudflared/<UUID>.json`. Reference that file in `~/.cloudflared/wordflux-config.yml` under `credentials-file:`.
3. Copy the example config to `~/.cloudflared/wordflux-config.yml`, set the hostnames you own, and point `credentials-file` at the path returned above. (Skip this step if you prefer using the one-time `CLOUDFLARE_TUNNEL_TOKEN` flow.)
4. Start the tunnel:
   ```bash
   ./scripts/run-cloudflared-tunnel.sh
   ```
5. Configure DNS records in Cloudflare so your chosen hostnames resolve to the tunnel.

For ad-hoc demos, omit the token and config entirely and rely on a [Quick Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/run-tunnel/trycloudflare/) by running `cloudflared tunnel --url http://localhost:8811` in a separate terminal (the script will prompt for a config in this case).
