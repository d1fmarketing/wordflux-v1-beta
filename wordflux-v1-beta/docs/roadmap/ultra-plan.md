# WordFlux ULTRA Roadmap

This document translates the 10-step ULTRATHINK plan into actionable engineering workstreams. Each section lists prerequisites, deliverables, and suggested tooling. Use it as the top-level backlog when promoting WordFlux from the current single-node beta to a globally distributed platform.

## 1. Remote Docker MCP Gateway

- **Goal:** Productionise the TaskCafe MCP server behind an authenticated SSE gateway.
- **Prereqs:** Docker MCP plugin, `taskcafe-mcp` image, catalog entries.
- **Deliverables:**
  - PM2 service (`wordflux-mcp-gateway`) using `scripts/run-mcp-gateway-sse.sh`.
  - Secrets stored via `docker mcp secret set` and rotated quarterly.
  - Health probe (`curl -H "Authorization: Bearer <token>" https://mcp.wordflux.dev/tools/taskcafe/list_cards`).
- **Follow-ups:** Add structured logging (JSON) piped to Filebeat/CloudWatch.

## 2. Cloudflare Tunnel & Edge Exposure

- **Goal:** Publish both the Next.js UI (3000) and MCP SSE endpoint (8811) without opening inbound firewall rules.
- **Prereqs:** Cloudflare account, domain, tunnel credentials.
- **Deliverables:**
  - `~/.cloudflared/wordflux-config.yml` derived from `infra/cloudflared/config.example.yml`.
  - PM2 entry or systemd unit invoking `scripts/run-cloudflared-tunnel.sh` with the issued token.
  - DNS CNAME records (`board.wordflux.dev`, `mcp.wordflux.dev`).
- **Follow-ups:** Configure Cloudflare Access policies (per-user OAuth) for MCP path.

## 3. Real-time Collaboration Layer

- **Goal:** Replace polling with push updates.
- **Options:**
  - Socket.IO (self-hosted) – simplest path, integrates with existing Next.js API route.
  - Supabase Realtime – requires DB migration (see step 5).
- **Deliverables:** Event contract (`board:update`, `board:changed` payload schema), optimistic UI updates, integration tests ensuring multi-client sync.

## 4. AWS Bedrock AgentCore Integration

- **Goal:** Reinstate the original plan of orchestrating WordFlux via Bedrock-hosted agents.
- **Prereqs:** AWS account with Bedrock + Lambda access, IAM role for agent.
- **Deliverables:**
  - Infrastructure template (`infra/cloudformation/agentcore.yml`) provisioning AgentCore gateway + Lambda functions.
  - Client SDK wrapper (`lib/agentcore-client.ts`) with retries/metrics.
  - Monitoring via CloudWatch dashboards and alarms.

## 5. AppSync Real-time API

- **Goal:** Event-driven board state propagation across clients and external integrations.
- **Prereqs:** GraphQL schema alignment with TaskCafe domain.
- **Deliverables:**
  - `infra/appsync/schema.graphql` with subscriptions (`onCardMoved`, `onCardCommented`).
  - Lambda resolvers bridging TaskCafe API ↔ AppSync subscriptions.
  - Client hook (`lib/hooks/useAppSyncBoard.ts`) to manage auth tokens and websocket lifecycle.

## 6. EventBridge Audit Trail

- **Goal:** Central audit stream for compliance & analytics.
- **Prereqs:** IAM role allowing `PutEvents` from AppSync/Lambda.
- **Deliverables:** EventBridge bus (`wordflux-audit`), event schema (CloudEvents-compatible), downstream targets (S3 archive, Lambda, optional Firehose → OpenSearch).

## 7. Cognito Authentication

- **Goal:** Managed auth with SSO providers.
- **Deliverables:**
  - Cognito User Pool + App Clients (web, CLI) via `infra/cognito/pool.yml`.
  - Replace Clerk placeholder in Next.js with `@aws-amplify/auth` or NextAuth + Cognito provider.
  - Migration scripts for existing beta users.

## 8. DynamoDB State Backbone

- **Goal:** Durable, multi-region state store for board metadata + AI transcripts.
- **Deliverables:**
  - Table design (`cards`, `columns`, `actions`) with GSIs for project/assignee queries.
  - Data migration pipeline from TaskCafe (one-off script + validation report).
  - Repository adapters (`lib/providers/dynamo-board.ts`).

## 9. Lambda@Edge + CloudFront CDN

- **Goal:** Push UI assets & critical API routes towards the edge, reduce latency.
- **Deliverables:**
  - IaC snippet attaching build artifacts to an S3 origin and CloudFront distribution.
  - Lambda@Edge viewer-request function injecting security headers & locale detection.
  - Deployment pipeline stage (GitHub Actions or CodeBuild) syncing `.next/static` → S3 and invalidating CloudFront.

## 10. Multi-region Kubernetes + GitOps

- **Goal:** Highly available, automatically reconciled deployments.
- **Prereqs:** EKS or GKE clusters in at least two regions, container registry, ArgoCD.
- **Deliverables:**
  - `k8s/` manifests for web app, MCP gateway sidecar, autoscaler, ingress.
  - ArgoCD application definitions referencing the repo’s `main` branch.
  - Disaster recovery runbook (regional failover, RPO/RTO targets).

---

### Suggested sequencing

1. Finish Steps 1–3 locally → polish developer UX.
2. Introduce Cognito (step 7) early to stop-gap auth, even before full Bedrock/AppSync migration.
3. Migrate data (step 8) before enabling AppSync/subscriptions (step 5) to avoid dual persistence.
4. Roll out Bedrock AgentCore (step 4) once MCP gateway & auth are production-grade.
5. Layer EventBridge audits (step 6) once AppSync or Bedrock events exist.
6. Conclude with edge/CDN/K8s (steps 9 & 10) alongside GitOps.

### Tracking

Convert each step into epics on the WordFlux board, adding acceptance criteria from this document. Revisit quarterly to adjust priorities based on usage and cost telemetry.
