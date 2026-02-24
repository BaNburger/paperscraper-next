# Quality Guardrails

These guardrails hardcode implementation expectations for every phase.

## Principle to Rule Mapping

| Principle | Required Behaviors | Rule IDs |
|---|---|---|
| Elegant | Explicit boundaries, simple control flow, no hidden cross-layer coupling | PSN001, PSN002, PSN003, PSN016 |
| Minimalist | No speculative abstractions, no unnecessary modules/components | PSN004, PSN005, PSN006, PSN010 |
| Flexible | Template/config behavior, no persona branches in core logic | PSN011, PSN012 |
| Maintainable | Compact files, bounded complexity, deterministic contracts | PSN007, PSN010, PSN015 |
| Secure | Safe primitives, validated boundaries, encrypted secrets, tenant isolation controls | PSN008, PSN012, PSN013 |
| Performant | Query budgets, pagination, index-backed hot paths, resilient workers | PSN009, PSN013, PSN014 |

## Global Quality Rules

1. Every change references phase requirement IDs.
2. Every external boundary is schema validated.
3. Every async workflow emits reliability diagnostics.
4. Every query path on list/search surfaces is paginated.
5. Every lint exception is time-bounded and owner-tagged.
