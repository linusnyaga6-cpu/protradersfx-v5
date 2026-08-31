---
name: Proposal retry idempotency
description: Keep trade retries safe when a proposal was already consumed or a prior request ended ambiguously.
---

A retry must request a new provider proposal and session rather than replaying a previously consumed proposal token. Duplicate nonce protection must remain enabled; surface conflicts as a clean fresh-proposal response instead of raw database SQL.

**Why:** A consumed proposal may have reached the provider even if the client did not receive a final response, so automatic replay can create a duplicate order.

**How to apply:** Clear stale client session state before a retry, generate a fresh session/proposal, and translate nonce conflicts to a safe 409. Never auto-retry a live purchase after an ambiguous provider response.