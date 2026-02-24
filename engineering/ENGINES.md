# Engine Contracts

This document defines engine responsibilities, boundaries, and phase-scoped expansions.

## Core Stage 1 Engines

1. Ingestion Engine
2. Graph Engine
3. Scoring Engine
4. Pipeline Engine
5. Query Engine

## Cross-Engine Contract

1. Engines communicate via queue events and persisted state.
2. Engines never import other engines directly (`PSN003`).
3. Routers invoke engine public APIs only (`PSN002`).
4. Adapters/providers own external network traffic (`PSN001`).

## Event Chain (Stage 1)

`stream.triggered -> ingest.stream -> object.created -> graph.resolve -> object.ready -> scoring.scoreObject -> object.score.created -> scoring.foldEntity -> entity.score.updated`

## Engine Details

### Ingestion Engine

Responsibilities:

1. Stream lifecycle operations.
2. OpenAlex fetch and normalization.
3. Dedup upsert persistence.
4. Stream run state lifecycle.
5. Emission of `object.created` events.

Primary phase references: S1.2, S1.EXIT.

### Graph Engine

Responsibilities:

1. Entity resolution from object metadata.
2. Object/entity relationship persistence.
3. Conservative merge policy enforcement.

Primary phase references: S1.3, S1.EXIT.

### Scoring Engine

Responsibilities:

1. Dimension lifecycle operations.
2. Provider-backed object scoring.
3. Output validation and persistence.
4. Entity score fold-up recomputation.
5. Backfill job orchestration.

Primary phase references: S1.3, S1.EXIT.

### Pipeline Engine

Responsibilities:

1. Pipeline/stage lifecycle operations.
2. Card add/move/remove semantics.
3. Board state retrieval.

Primary phase references: S1.4, S2.W1.

### Query Engine

Responsibilities:

1. Feed retrieval with filter/sort/pagination.
2. Object detail hydration.
3. Entity detail hydration.
4. Search path expansion (S2.W3).

Primary phase references: S1.4, S2.W3.

## Stage 2 Extensions

1. S2.W2: tenant-aware guards and role checks around engine operations.
2. S2.W3: search ranking and trigger evaluator paths.
3. S2.W4: plugin runtime integration points.

## Required Error-Handling Behavior

1. Retryable and permanent failure classification.
2. Exponential backoff and bounded retries.
3. Dead-letter handling after retry exhaustion.
4. Failure visibility with actionable context.
5. Non-blocking UI impact for recoverable backend failures.
