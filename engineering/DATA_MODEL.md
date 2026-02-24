# Data Model Contract

This document describes stage-scoped schema expectations. The canonical requirement mapping is in `pm/phases/*`.

## Stage 1 Base Tables

1. `streams`
2. `stream_runs`
3. `research_objects`
4. `entities`
5. `object_entities`
6. `dimensions`
7. `object_scores`
8. `entity_scores`
9. `pipelines`
10. `pipeline_stages`
11. `object_pipeline_cards`
12. `api_keys`

## Stage 1 Constraints

1. Object dedup key: `(externalId, source)`.
2. Object score uniqueness: `(dimensionId, objectId)`.
3. Entity score uniqueness: `(dimensionId, entityId)`.
4. Pipeline card uniqueness: `(pipelineId, objectId)`.
5. Explicit projections on reads (`SELECT *` forbidden).

## Stage 1 Optional Provisioning

1. `pgvector` extension and embedding column may be provisioned.
2. Vector search behavior remains out-of-scope until S2.W3.

## Stage 2 Data Expansions

### S2.W1

1. `views` (saved filter/sort/layout state).

### S2.W2

1. `workspaces`
2. `users`
3. workspace role bindings
4. `workspace_id` columns on Stage 1 tables
5. `audit_logs`
6. RLS policies and tenant-scoped indexes

### S2.W3

1. `trigger_rules`
2. `trigger_executions`
3. Search indexing additions as benchmark-approved

### S2.W4

1. `plugin_registrations`
2. `plugin_runs`

## Integrity and Security Rules

1. Strict FK integrity for score and pipeline entities.
2. Encrypted secret material only (`enc:v1:*` format).
3. Audit logs append-only.
4. Tenant data isolation enforced by both app-layer and DB-layer policies.
