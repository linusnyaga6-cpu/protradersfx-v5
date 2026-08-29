---
name: Deriv OAuth trading flow
description: The current Deriv OAuth integration boundary for account discovery and authenticated options WebSockets.
---

Deriv OAuth access tokens must be sent to the REST API as `Authorization: Bearer ...` together with the registered `Deriv-App-ID` header. Authenticated options account discovery uses the REST accounts endpoint, and trading WebSockets require a fresh OTP URL from the account OTP endpoint. Sending the OAuth token through the legacy WebSocket `authorize` request is rejected.

**Why:** Deriv's current OAuth/API boundary separates REST bearer-token authentication from the short-lived, account-scoped WebSocket handshake.

**How to apply:** Use REST account data as the authoritative source for account ID, type, currency, and balance; request a new OTP immediately before each authenticated trading WebSocket connection.