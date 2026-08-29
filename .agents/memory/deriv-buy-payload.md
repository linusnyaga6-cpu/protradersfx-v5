---
name: Deriv proposal purchase payload
description: Required request shape when purchasing a Deriv proposal over an OAuth OTP WebSocket.
---

When purchasing with a proposal ID over Deriv's OAuth OTP WebSocket, send `buy` and `price` as top-level request fields. The `parameters` object is for direct contract-parameter purchases, not the proposal-ID flow.

**Why:** Deriv accepts proposal previews but rejects the subsequent purchase when the reviewed ask price is nested under `parameters`, causing every execution path to fail at the shared buy boundary.

**How to apply:** Keep Instant Trade, scanner-assisted trades, and Bots on the shared server purchase endpoint, and verify the current official Buy Contract schema before changing its payload.