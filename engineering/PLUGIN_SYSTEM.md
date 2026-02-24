# Plugin System Contract (S2.W4 Only)

The plugin system is not allowed in Stage 1, S2.W1, or S2.W2.

## Activation Gate

Plugin implementation may start only after:

1. S2.W3 exit gate passes.
2. Tenancy, authz, and audit controls from S2.W2 are operational.
3. Stage 1 baseline regression suite remains green.

## Supported Plugin Types

1. Source plugins (ingestion extensions)
2. Processor plugins (enrichment/scoring context)
3. Action plugins (outbound workflow actions)

## Security Requirements

1. Strict SSRF protection for plugin URLs.
2. HMAC request signing.
3. Request/response schema validation.
4. Timeout and bounded retry controls.
5. Per-plugin rate limits.
6. Workspace-scoped authz enforcement.

## Failure Isolation Rules

1. Plugin failure cannot block core ingestion/scoring/pipeline workflows.
2. Plugin failures are logged with structured context.
3. Unhealthy plugins are quarantined after threshold breaches.

## Observability Requirements

1. Record invocation latency and status.
2. Record retry and timeout counts.
3. Record payload validation failures.
4. Record per-plugin health state transitions.

## Administrative Controls

1. Plugin registration/update/remove restricted to authorized roles.
2. Plugin actions fully auditable via append-only logs.
3. Plugin runtime controls exposed in dedicated admin surfaces only.
