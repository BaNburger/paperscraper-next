# PaperScraper Next

PaperScraper Next is built in two strict stages:

1. Stage 1: Local 10x MVP
2. Stage 2: Productization Without Bloat

This repository is documentation-first and execution-gated. Every implementation phase has a self-contained packet and a matching agent runbook.

## Read Order by Role

### Product
1. `pm/PRD.md`
2. `pm/phases/`
3. `pm/VISION.md`
4. `pm/PERSONAS.md`

### Engineering
1. `pm/PRD.md`
2. `pm/phases/`
3. `engineering/ARCHITECTURE.md`
4. `engineering/ENGINES.md`
5. `engineering/DATA_MODEL.md`

### Agents (Codex + Claude)
1. `AGENTS.md`
2. `agents/WORKFLOW.md`
3. `agents/QUALITY_GUARDRAILS.md`
4. `agents/phases/<PHASE>.md`
5. Runtime overlay (`agents/CODEX.md` or `claude-code/CLAUDE.md`)

## Canonical Structure

```
.
├── AGENTS.md
├── README.md
├── apps/
│   ├── api/
│   ├── jobs/
│   └── web/
├── packages/
│   ├── db/
│   └── shared/
├── infra/
│   └── docker-compose.yml
├── pm/
│   ├── PRD.md
│   ├── VISION.md
│   ├── PERSONAS.md
│   ├── MVP_SCOPE.md
│   ├── V1_STRENGTHS.md
│   └── phases/
│       ├── S1_1_FOUNDATION.md
│       ├── S1_2_STREAMS_INGESTION.md
│       ├── S1_3_GRAPH_SCORING.md
│       ├── S1_4_PIPELINE_FRONTEND.md
│       ├── S1_EXIT_ACCEPTANCE_GATE.md
│       ├── S2_W1_UX_HARDENING.md
│       ├── S2_W2_PLATFORM_FOUNDATIONS.md
│       ├── S2_W3_SELECTIVE_INTELLIGENCE.md
│       └── S2_W4_EXTENSIBILITY_ADMIN.md
├── engineering/
│   ├── ARCHITECTURE.md
│   ├── ENGINES.md
│   ├── DATA_MODEL.md
│   └── PLUGIN_SYSTEM.md
├── agents/
│   ├── WORKFLOW.md
│   ├── QUALITY_GUARDRAILS.md
│   ├── PHASE_RUNBOOK_TEMPLATE.md
│   ├── CODEX.md
│   └── phases/
├── claude-code/
│   ├── CLAUDE.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── STAGE_1_LOCAL_MVP.md
│   ├── STAGE_2_PRODUCTIZATION.md
│   └── PHASE_*.md (archived stubs)
├── config/
│   ├── agent-lint-rules.yaml
│   └── phase-gates.yaml
├── schemas/
│   ├── phase-meta.schema.json
│   ├── requirement-ref.schema.json
│   ├── agent-lint-rule.schema.json
│   └── phase-gate.schema.json
└── tools/
    ├── agent-lint/
    ├── docs-lint/
    └── phase-gate/
```

## S1.1 Verification Flow

1. Install dependencies:
   - `npm install`
2. Create local env once:
   - `cp -n .env.example .env`
3. Start local infra (PostgreSQL + Redis):
   - `npm run infra:up`
4. Apply base schema migration:
   - `bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy`
5. Start runtimes:
   - API: `npm run dev:api`
   - Jobs: `npm run dev:jobs`
   - Web: `npm run dev:web`
6. Smoke checks:
   - `curl http://localhost:4000/health`
   - `curl "http://localhost:4000/trpc/system.health?input=%7B%7D"`
7. Fast phase gate:
   - `npm run gate:phase -- --phase=S1.1`
8. Runtime smoke gate:
   - `node tools/phase-gate/verify-s1_1.mjs --mode=runtime`

## S1.2 Verification Flow

1. Keep infra running and ensure env is present:
   - `cp -n .env.example .env`
   - `npm run infra:up`
2. Apply migrations:
   - `bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy`
3. Run fast S1.2 gate:
   - `npm run gate:phase -- --phase=S1.2`
4. Run runtime smoke verifier (stream trigger, ingestion, dedup, queue evidence):
   - `node tools/phase-gate/verify-s1_2.mjs --mode=runtime`

Notes:
1. `verify-s1_2` uses a local mock OpenAlex service for blocking contract checks.
2. It also performs a live OpenAlex probe as a non-blocking warning check.

## S1.3 Verification Flow

1. Keep infra running and ensure env is present:
   - `cp -n .env.example .env`
   - `npm run infra:up`
2. Set required scoring secrets in your shell or `.env`:
   - `SECRETS_MASTER_KEY` (base64-encoded 32-byte key)
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - optional model overrides: `OPENAI_SMOKE_MODEL`, `ANTHROPIC_SMOKE_MODEL`
3. Apply migrations:
   - `bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy`
4. Run fast S1.3 gate:
   - `npm run gate:phase -- --phase=S1.3`
5. Run runtime smoke verifier (ingest -> graph resolve -> score -> fold-up):
   - `node tools/phase-gate/verify-s1_3.mjs --mode=runtime`

Notes:
1. API and jobs start even when `SECRETS_MASTER_KEY` is missing.
2. `apiKeys.upsert` and scoring paths fail deterministically until `SECRETS_MASTER_KEY` is configured.

## S1.4 Verification Flow

1. Keep infra running and ensure env is present:
   - `cp -n .env.example .env`
   - `npm run infra:up`
2. Apply migrations:
   - `bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy`
3. Start runtimes:
   - `npm run dev:api`
   - `npm run dev:jobs`
   - `npm run dev:web`
4. Run fast S1.4 gate:
   - `npm run gate:phase -- --phase=S1.4`
5. Run runtime smoke verifier (ingest -> feed -> object -> entity -> pipeline operations + bundle budgets):
   - `node tools/phase-gate/verify-s1_4.mjs --mode=runtime`
6. Run UI interaction smoke verifier (blocking in CI):
   - `node tools/phase-gate/verify-s1_4_ui.mjs --mode=runtime`

Manual QA checklist:
1. `/feed`: loading/empty/error states, filter/sort/cursor controls, streams/API-key side pane tabs.
2. `/objects/<id>` and `/entities/<id>`: metadata + linked graph/score data.
3. `/pipeline`: split board/editor layout, inline edits, add/remove card, drag/drop move with rollback on failure.

## S1.EXIT Verification Flow

S1.EXIT is acceptance-only and adds no new product features.

1. Keep infra running and ensure env is present:
   - `cp -n .env.example .env`
   - `npm run infra:up`
2. Ensure required runtime secrets are set for runtime mode:
   - `SECRETS_MASTER_KEY`
   - `OPENAI_API_KEY`
   - optional `OPENAI_SMOKE_MODEL` (default `gpt-4o-mini`)
3. Run fast exit gate:
   - `npm run gate:phase -- --phase=S1.EXIT`
4. Run strict runtime acceptance verifier:
   - `node tools/phase-gate/verify-s1_exit.mjs --mode=runtime`
5. Run Stage 1 aggregate gate:
   - `npm run gate:stage1`

Runtime acceptance evidence is written to:
1. `artifacts/stage1-acceptance/latest/summary.json`
2. `artifacts/stage1-acceptance/latest/metrics.json`
3. `artifacts/stage1-acceptance/latest/events.json`
4. `artifacts/stage1-acceptance/latest/report.md`

Blocking runtime thresholds:
1. Time to first score `< 60s`
2. Feed benchmark p95 DB execution time `<= 200ms`

## Why npm + Bun

1. Root scripts use `npm run ...` as the repository control plane for lint/gates/runbooks.
2. Service runtimes stay Bun-native (`dev:*` scripts call `bun run ...` inside each workspace).
3. This keeps one governance entrypoint while preserving Bun performance where it matters.

## Non-Negotiable Rules

1. Stage 1 keeps exactly 4 top-level screens: Feed, Object Detail, Entity Detail, Pipeline Board.
2. Stage 1 stays manual-first (no trigger automation, plugins, chat, or hybrid search).
3. Stage 2 waves execute in order: W1 -> W2 -> W3 -> W4.
4. No phase is complete unless its exit gate passes.

## Required Commands

1. `npm run lint:agents`
2. `npm run lint:docs`
3. `npm run lint:phase -- --phase=<PHASE_ID>`
4. `npm run gate:phase -- --phase=<PHASE_ID>`
5. `npm run gate:stage1`
6. `npm run gate:stage2`
7. `npm run quality:premerge`

## Legacy Documents

`claude-code/PHASE_01_*.md` through `claude-code/PHASE_08_*.md` are preserved as archive stubs only. They are not requirements sources.
