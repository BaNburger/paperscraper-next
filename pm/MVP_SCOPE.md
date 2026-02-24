# Stage 1 MVP Scope

This file is Stage 1 scope lock. Detailed requirements live in:

- `pm/phases/S1_1_FOUNDATION.md`
- `pm/phases/S1_2_STREAMS_INGESTION.md`
- `pm/phases/S1_3_GRAPH_SCORING.md`
- `pm/phases/S1_4_PIPELINE_FRONTEND.md`
- `pm/phases/S1_EXIT_ACCEPTANCE_GATE.md`

## Stage 1 Goal

Prove the full loop locally with a strict minimal surface:

Subscribe -> Ingest -> Score -> Review -> Act

## Locked Decisions

1. Four top-level screens only.
2. OpenAlex only.
3. Real BYOK scoring.
4. Manual pipeline behavior.
5. Single-workspace local mode.

## In Scope

1. Stream create and manual trigger.
2. Ingestion + dedup + run tracking.
3. Entity resolution + object/entity linking.
4. Dimension management + scoring + entity fold-up.
5. Pipeline board manual card operations.
6. Feed/Object Detail/Entity Detail/Pipeline Board UI.

## Out of Scope

1. Auth/RBAC/multitenancy.
2. Trigger automation.
3. Plugins/webhooks.
4. Chat and hybrid semantic search.
5. New top-level navigation surfaces.

## Performance Targets

1. First scored result < 60s from trigger.
2. Feed query p95 < 200ms DB time.
3. Scoring success rate > 95% (provider outages excluded).

## Stage Rule

Stage 2 starts only when S1.EXIT passes.
