# Product Vision

## One-Liner

PaperScraper Next is an analytical CRM for research intelligence that converts continuous research signals into actionable workflows.

## Core Loop

Subscribe -> Ingest -> Score -> Review -> Act

## What Makes It Valuable

1. User-defined dimensions drive evaluation, not hardcoded scoring.
2. Entity-level intelligence accumulates over time through fold-up scoring.
3. Workflow action is first-class via pipeline boards.
4. Templates tailor setup for personas without changing core product logic.

## Stage-Aware Vision

### Stage 1 (Local MVP)

1. Prove end-to-end value with four top-level screens.
2. Keep architecture lean and manual-first.
3. Use one source (OpenAlex) and real BYOK scoring.

### Stage 2 (Productization)

1. Improve workflow speed and clarity first (W1).
2. Add production security/isolation next (W2).
3. Add selective intelligence only with benchmark proof (W3).
4. Add extensibility and enterprise administration last (W4).

## Design Principles

1. Elegant: clear APIs, explicit boundaries, no hidden control flow.
2. Minimalist: the smallest surface that ships meaningful value.
3. Flexible: template/config driven behavior over persona-specific code branches.
4. Maintainable: small modules, bounded complexity, deterministic contracts.
5. Secure: validated boundaries, least privilege, auditable mutations.
6. Performant: explicit query budgets, async reliability, regression gates.

## Anti-Bloat Rule

A feature is accepted only if it makes the core loop faster, clearer, or more reliable.
