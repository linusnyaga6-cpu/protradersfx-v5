---
name: Deriv public quote compatibility
description: Provider behavior to account for when retrieving public Deriv symbols and current quotes.
---

Prefer the latest `ticks_history` value as a compatible current-quote fallback when a one-shot `ticks` request rejects a symbol. Treat an empty `active_symbols` response as unavailable discovery rather than proof that no instruments exist. Keep public multi-symbol ticker polling conservative; one independent rapid loop per symbol can exhaust the shared API rate limit.

**Why:** Deriv's public test app returned valid current candle/tick history for a legacy synthetic symbol while rejecting the same symbol through `ticks` and returning an empty active-symbol list. Six three-second homepage quote loops saturated the application rate limiter.

**How to apply:** Preserve explicit source/freshness labels, use configured allowlists as a clearly identified discovery fallback, and never invent quotes or symbol availability. Prefer one slowly refreshed public quote plus static watch chips, or a server-aggregated ticker endpoint.