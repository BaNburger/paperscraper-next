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
