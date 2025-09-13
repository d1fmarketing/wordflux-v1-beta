# North Star Map — Kanban + Agente Conversacional (GPT‑5)

Este documento guia todo o projeto: visão, domínio, arquitetura, DSL do agente, APIs, segurança/NFRs, plano de ação por fases, backlog detalhado, critérios de aceite, riscos, métricas e status de entrega. Use este arquivo como a fonte da verdade (vamos marcar OK conforme avançarmos).

---

## 1) Visão (NS‑01) [OK]
- Objetivo: Board Kanban para estúdios/equipes, controlado por um Agente conversacional (GPT‑5), que entende linguagem natural e opera o board (criar/mover/atribuir/comentar/concluir).
- Escopo do MVP: Board estável (Backlog/Doing/Done) + Chat (PT/EN) + Agente que interpreta e executa as ações no board. Voz depois.
- Decisão base: usar um Kanban pronto e estável (Planka) e focar engenharia no Agente + Adapter. Cores/branding depois.

---

## 2) Domínio & IDs (NS‑02) [OK]
- Prefixos ULID:
  - Workspace `ws_01H…`, Team `team_01H…`, User `user_01H…`, Board `board_01H…`, Column `col_01H…`, Card `card_01H…`, Comment `cm_01H…`, ChecklistItem `chk_01H…`, Request `req_01H…`, Event `evt_01H…`, Operation `op_01H…`.
- Entidades (MVP):
  - Workspace: { id, name }
  - Team: { id, name, members: user[] }
  - User: { id, name, email?, avatarUrl? }
  - Board: { id, name, teamId, version:int }
  - Column: { id, boardId, name, order:int, wipLimit?:int }
  - Card: { id, boardId, columnId, title, desc, status:colId, assignees:user[], labels:string[], dueDate?:ISO, points?:number, checklist:ChecklistItem[], createdAt, updatedAt }
  - ChecklistItem: { id, text, done:bool }
  - Comment: { id, cardId, author:user|'Agent', text, createdAt }

---

## 3) DSL do Agente (NS‑03) [OK]
- Ações suportadas (MVP):
  - `create_card`: { column:'Backlog'|'Doing'|'Done', title, description?, assignees?, labels?, dueDate?, points? }
  - `move_card`: { id|cardQuery, toColumn }
  - `update_card`: { id|cardQuery, set:{ title?, description?, labels?, assignees?, dueDate?, points? } }
  - `assign`: { id|cardQuery, assignees:[string] }
  - `comment`: { id|cardQuery, text }
  - `complete`: { id|cardQuery } → move Done
  - `set_wip_limit`: { column, limit }
- CardQuery:
  - `title:"…" assignee:… status:Backlog priority:high label:marketing`
- Envelope:
  - Request: { message, boardId, requestId? }
  - Response: { reply, actions:[…], boardVersion?, summary }
- Regras:
  - Idempotência (requestId obrigatório no write)
  - Concorrência (ifVersion + retry 1x)
  - Clarificações quando ambiguidades

---

## 4) Arquitetura (NS‑04) [OK]
- Base Kanban: Planka (Docker/Compose). Board inicial: “Studio Board” com Backlog/Doing/Done.
- Agent Service (Next/Node):
  - `/api/agent/interpret`: chama GPT‑5 → JSON actions → valida (Zod) → Adapter (Planka) → aplica idempotência/ifVersion → resposta amigável.
- Adapter: `BoardAdapter` com impl. `AdapterPlanka` (REST). Futuro: `AdapterNative` (Prisma/Postgres).
- UI: layout 2‑panes: Chat à esquerda (nosso) + iframe Planka à direita; Ao aplicar ações, refresh do board.

---

## 5) APIs (NS‑05) [OK]
- `POST /api/agent/interpret`
  - body: { message, boardId?, requestId? }
  - resp: { reply, actionsApplied?, status:'ok'|'error', error? }
- `POST /api/board/apply` (mantido para modo "internal")
  - body: { op|ops, ifVersion?, requestId }
  - resp: { ok, board, version, results? } | { error, code, currentVersion? }
- `GET /api/board/get?boardId=`
  - resp: { board, version }

---

## 6) Segurança (NS‑06) [OK]
- Env:
  - `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5-mini`
  - `PLANKA_BASE_URL`, `PLANKA_TOKEN`
  - `BOARD_ADAPTER=internal|planka` (default: internal enquanto Planka não sobe)
- Idempotência: TTL 15 min
- Rate limit: 5 req/10s por user
- Logs: reqId, op, latency, outcome

---

## 7) NFRs (NS‑07) [OK]
- Estabilidade: 0 travamentos na UI (canários 24h)
- Desempenho: p95 < 2s, p99 < 5s
- Observabilidade: canários simples (5 min) e extendido (manual contínuo até 100%)

---

## 8) Backlog de Features (NS‑08) [OK]
- F1 Board & Colunas
  - F1.1 Criar Board (Backlog/Doing/Done) [OK]
  - F1.2 WIP por coluna [ ]
- F2 Cards
  - F2.1 CRUD base (title/desc) [ ]
  - F2.2 Assignees [ ]  F2.3 Labels [ ]  F2.4 Due date [ ]  F2.5 Points [ ]
  - F2.6 Checklist [ ]  F2.7 Comments [ ]  F2.8 Duplicar/Deletar [ ]
- F3 Busca/Filtros (CardQuery) [ ]
- F4 Agente
  - F4.1 Interpretador DSL (PT/EN) [OK base]
  - F4.2 Resolver queries ambíguas [OK]
  - F4.3 Execução com idempotência/ifVersion [OK]
  - F4.4 Resumo do que foi feito [OK base]
- F5 Chat UI
  - F5.1 Input + Send (PT/EN) [OK base]
  - F5.2 Histórico na sessão [ ]
  - F5.3 Fallback ok sem OPENAI [OK]
- F6 Observabilidade
  - F6.1 Canário simples (load/add/move/reset) [OK]
  - F6.2 Canário extendido 100% (editar/deletar/chat robusto) [ ]
- F7 Infra
  - F7.1 Docker Compose Planka [OK]
  - F7.2 Tunnel público [OK]
  - F7.3 PM2 processos [OK]
- F8 Segurança
  - F8.1 Rate-limit + idempotência [OK]
  - F8.2 Proteção de tokens [ ]
- F9 Roadmap
  - F9.1 Voz (STT/TTS) [ ]
  - F9.2 Notificações [ ]
  - F9.3 Multi‑board/tenant [ ]

---

## 9) Plano de Ação por Fase (NS‑09)
- Fase 0 – Preparação
  - P0.1 Escolher base Planka [OK]
  - P0.2 Adicionar docker-compose de Planka (porta 3015) [OK]
  - P0.3 Seed de board Backlog/Doing/Done [OK base]
  - Aceite: GET no board via API do Planka mostra 3 colunas

- Fase 1 – Adapter & API
  - P1.1 Criar interface `BoardAdapter` [OK]
  - P1.2 Criar `AdapterPlanka` (métodos básicos) [OK base]
  - P1.3 Habilitar `BOARD_ADAPTER=planka` por env [OK]
  - P1.4 `/api/board/apply` usa Adapter quando planka [OK base]
  - Aceite: canário simples verde 3x seguidas

- Fase 2 – Agente
  - P2.1 Prompt sistema + few‑shots (PT/EN) [ ]
  - P2.2 `/api/agent/interpret` → valida ações (Zod) → aplica Adapter [OK base]
  - P2.3 Follow‑ups de ambiguidade [OK]
  - Aceite: “Cria card p/ Augusto terminar site” funciona fim‑a‑fim

- Fase 3 – UI
  - P3.1 Chat à esquerda + iframe do Board à direita [OK base]
  - P3.2 Refresh do iframe após ação [OK base]
  - P3.3 UX do resumo textual [ ]
  - Aceite: Conversa→ação refletida no board sem travar

- Fase 4 – Hardening
  - P4.1 Canário extendido 100% (modal edit/delete/chat robusto) [ ]
  - P4.2 Rate-limit e idempotência confirmados [OK base]
  - P4.3 “Sem OPENAI” não quebra (já ok) [OK]
  - Aceite: 0 runtime errors na UI por 24h

---

## 10) Critérios de Aceite (NS‑10)
- A1 Agente executa (create/move/comment/assign/complete) com confirmação textual
- A2 Board não trava com 409 (re-sinc + retry 1x)
- A3 Chat sempre responde (fallback se OPENAI ausente)
- A4 Canários simples e estendidos verdes (3x seguidas)
- A5 Logs com reqId/opId/latência/resultado

---

## 11) Riscos & Mitigações (NS‑11)
- R1 Ambiguidade → follow‑ups curtos
- R2 Custo GPT → throttle, batch e prompt minimalista
- R3 Falhas do Kanban base → retry/backoff + alerta
- R4 Conflitos (409) → refresh + retry 1x
- R5 Voz/integrações → endpoint único e adapters

---

## 12) Métricas (NS‑12)
- p95 ação < 2s; p99 < 5s
- 0 travamentos em 24h de canários
- 95% comandos simples sem follow‑up
- 0 perdas com idempotência

---

## 13) Status Snapshot
- Base atual: Next.js app + canários simples OK + Chat com fallback
- Progresso recente: AdapterPlanka (métodos básicos, fallback e mapeamento por env), Clarificação no chat, Rate-limit + idempotência, docker-compose Planka, seed helper e verificador.
- Próximos: alinhar endpoints do Planka (produção), ativar modo estrito, refresh do iframe pós-ação, canário estendido 100%.

> A cada entrega, atualizaremos este arquivo marcando os passos com [OK].

---

## 14) Plano Estendido (12 semanas) — Entregas semana a semana

- S1: Infra/Seed
  - Subir Planka (compose) [ ]
  - Criar board “Studio Board” + Backlog/Doing/Done [ ]
  - Documentar geração de PLANKA_TOKEN [ ]
  - Health-check do serviço (curl) [ ]

- S2: AdapterPlanka (CRUD básico)
  - createCard/moveCard/updateCard/deleteCard [ ]
  - findCards (title/label/assignee/status/priority) [ ]
  - idempotência/ifVersion pass-through [ ]
  - Testes com board seed (manual/auto) [ ]

- S3: Integração Agente → Planka
  - BOARD_ADAPTER=planka ativo [ ]
  - `/api/agent/interpret` 100% via adapter [ ]
  - Fluxos: criar, mover, comentar, atualizar, atribuir [ ]

- S4: UI 2-panes
  - iframe do Planka à direita [ ]
  - Refresh pós-ação [ ]
  - UX “resumo do que foi feito” [ ]

- S5: Canário estendido (1)
  - Modal edit/title [ ]
  - Delete via modal [ ]
  - Chat reply robusto (desktop/móvel) [ ]

- S6: Follow-ups (ambiguidades)
  - Perguntas curtas: “Qual card?” [ ]
  - Persistência de contexto curto [ ]

- S7: Segurança
  - Rate-limit efetivo [ ]
  - Proteção de tokens/env [ ]

- S8: Observabilidade
  - Logs estruturados (reqId/opId) [ ]
  - Resumo do canário no log principal [ ]

- S9: Hardening 24h
  - Rodar canários por 24h sem falhas [ ]
  - Ajustes finos de performance [ ]

- S10: Roadmap Voz (sketch)
  - Especificar fluxo STT→/agent/interpret→TTS [ ]

- S11: Branding (tema)
  - Paleta, logo, tipografia [ ]

- S12: Multi-board/tenant
  - Seleção e permissões [ ]
