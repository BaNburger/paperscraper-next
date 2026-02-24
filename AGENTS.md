# PaperScraper Next Agent Contract

This is the canonical contract for all coding agents working in this repository.

## Scope and Precedence

Order of truth when requirements conflict:

1. `pm/PRD.md`
2. `pm/phases/*.md`
3. `engineering/*.md`
4. `agents/*.md`
5. Runtime overlays (`agents/CODEX.md`, `claude-code/CLAUDE.md`)

Archived legacy files in `claude-code/PHASE_*.md` are never authoritative.

## Product Constraints

1. Stage 1 has exactly 4 top-level screens: Feed, Object Detail, Entity Detail, Pipeline Board.
2. Stage 1 is manual-first and excludes plugins, trigger automation, chat/query interfaces, and hybrid semantic search.
3. Stage 2 executes strictly in waves: W1 -> W2 -> W3 -> W4.
4. No phase can be marked complete before all phase exit criteria pass.

## Non-Negotiable Architecture Rules

- `PSN001`: No ad hoc network calls outside API/adapter/provider boundaries.
- `PSN002`: Routers must call engine APIs only (no direct DB/raw SQL).
- `PSN003`: Engines must not directly import other engines.
- `PSN004`: No unused/single-use dependencies unless explicitly allowlisted.
- `PSN005`: No single-use shared UI components.
- `PSN006`: No single-use helper/util files.
- `PSN007`: Keep files compact via enforced line caps.
- `PSN008`: No unsafe execution or insecure primitives.
- `PSN009`: Performance guardrails are mandatory (`SELECT *` forbidden; workers require concurrency/retries).
- `PSN010`: Avoid ad hoc function sprawl (max functions/file enforced).
- `PSN011`: No persona-specific branching in core logic (persona behavior must be template/config driven).
- `PSN012`: Every external boundary must be schema validated (API/provider/plugin edges).
- `PSN013`: Async jobs require observability (retry state, duration, failure reason, queue depth).
- `PSN014`: Query safety budgets are mandatory (explicit projection, pagination, index-backed hot paths).
- `PSN015`: Complexity caps are mandatory (function/file complexity budgets in addition to line caps).
- `PSN016`: Dependency hygiene by layer is mandatory (no cross-layer leakage outside explicit allowlists).

## Mandatory Workflow

1. `npm run lint:agents`
2. `npm run lint:docs`
3. `npm run lint:phase -- --phase=<PHASE_ID>`
4. `npm run gate:phase -- --phase=<PHASE_ID>`
5. Run touched-area checks:
   - Backend/infra: `npm run check:touched:backend`
   - Frontend: `npm run check:touched:frontend`
6. Do not claim completion while any lint/gate command fails.

## Forbidden Patterns

1. New top-level navigation outside the Stage 1 four-screen surface.
2. Stage 1 introduction of plugins, trigger automation, chat/query, or hybrid semantic retrieval.
3. Router-level direct DB access and raw SQL.
4. Shared component/helper abstractions with a single usage site.
5. Inline lint suppressions and hidden bypass comments.

## Exception Process

Inline suppressions are not allowed.

The only valid exception file is:

- `/Users/bastianburger/Repos/PaperScraperNext/.agent-lint-allowlist.yaml`

Every allowlist entry must include:

1. `rule_id`
2. `path`
3. `match`
4. `reason`
5. `owner`
6. `expires_on` (ISO date)

Invalid or expired entries must fail `lint:agents`.

## Execution Discipline

1. Prefer minimal, explicit, maintainable designs over framework-heavy abstractions.
2. Build only what the active phase requires.
3. Every code change must map to a phase requirement ID.
4. Avoid speculative extensibility unless required by current phase acceptance criteria.
