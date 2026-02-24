# V1 Strengths to Preserve (Stage-Aware)

This document captures what to preserve from prior systems without violating the Stage 1 -> Stage 2 delivery order.

## Keep

1. Route-level performance discipline and lazy loading.
2. Clear boundary enforcement between routers, engines, and adapters.
3. Secure defaults (httpOnly sessions, encrypted key storage, SSRF controls).
4. Strong lint governance and exception expiry.
5. High-signal workflow design over broad feature sprawl.

## Adapt

1. Reduce architecture breadth to phase-required modules only.
2. Use template/config behavior instead of persona-specific logic branches.
3. Keep admin/compliance modular and delayed to S2.W4.
4. Introduce hybrid search only with benchmark gate in S2.W3.

## Drop or Defer

1. Broad page surfaces that dilute the core loop.
2. Trigger-heavy automation before S2.W3.
3. Plugin infrastructure before S2.W4.
4. Premature platform abstractions without concrete reuse.

## Rule for Reuse

A V1 pattern is accepted only if it improves the current phase without violating PSN rules or stage constraints.
