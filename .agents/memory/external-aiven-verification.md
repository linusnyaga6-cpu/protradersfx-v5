---
name: External Aiven verification
description: How to verify an external Aiven production database when the project also has a Replit-managed database.
---

The built-in Replit Production SQL callback is scoped to the Replit-managed production replica. It cannot inspect or validate an external Aiven database used by the deployed application.

**Why:** The application can be connected successfully to Aiven while Replit's own production replica is frozen, empty, or otherwise unrelated to the live database.

**How to apply:** Confirm the live app's database identity through a sanitized authenticated diagnostic, then run read-only metadata queries in Aiven PG Studio. Never run the workspace Drizzle push against the Replit URL when Aiven is the production provider.