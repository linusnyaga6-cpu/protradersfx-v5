---
name: Account selection cache race
description: The UI pattern required to keep an explicitly selected Demo or Real account from being overwritten by polling.
---

When an account-type switch updates the server session, cancel the shared account query before requesting the new account, then write the successful response directly into the shared cache. Do not immediately invalidate and refetch the same polling query.

**Why:** A refresh that started before the switch can finish afterward and overwrite the selected account in the UI, making the account appear to switch back.

**How to apply:** Use the exact shared account query key for cancellation and cache replacement; let the existing finite polling interval perform the next authoritative refresh.