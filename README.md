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
