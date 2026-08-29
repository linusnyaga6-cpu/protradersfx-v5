---
name: Deriv proposal purchase flow
description: Connection and payload requirements when purchasing a Deriv proposal over an OAuth OTP WebSocket.
---

Create the execution-time proposal and buy it on the same OAuth OTP WebSocket connection. Send `buy` and `price` as top-level request fields; the `parameters` object is for direct contract-parameter purchases, not the proposal-ID flow. Retain the signed preview review as the maximum approved price, and require another review if the fresh execution price increases.

**Why:** Deriv can accept a proposal preview but reject a purchase made on a separate short-lived authenticated connection. It also rejects proposal-ID purchases when the reviewed ask price is nested under `parameters`.

**How to apply:** Keep manual, bulk, AI-assisted, and bot sessions on the shared server purchase endpoint. Generate a fresh matching proposal and purchase it before closing that connection while preserving single-use review approval.