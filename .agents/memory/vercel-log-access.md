---
name: Vercel runtime-log access
description: The installed Vercel connection may be unable to retrieve historical deployment/runtime logs when its API key returns 403.
---

The safest way to obtain a completed production request diagnostic is the Vercel dashboard's Runtime Logs for the exact deployment, or a repaired Vercel connection whose API key has project deployment/runtime-log read permission. An API-key connection cannot use the OAuth reauthorization flow. Even after project/deployment access is repaired, the runtime-log stream can return HTTP 200 with an `Exceeded query duration limit of 5 minutes` delimiter and no records.

**Why:** The connector's API-key context can return a bare 403 for deployment and runtime-log endpoints while the public deployment remains healthy; after scope repair, the runtime stream may still time out because it exposes no server-side time/path filter.

**How to apply:** When a production failure needs an exact server exception, first match the deployment and request timestamp, then retrieve the server event. If access is 403, repair the provider-side key scope; if the authorized stream times out, use the dashboard's filtered Runtime Logs instead. Avoid speculative code or database changes.