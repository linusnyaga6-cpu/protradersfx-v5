---
name: GitHub connector write throttling
description: An environment-specific limitation encountered when publishing many repository files through the connected GitHub API.
---

Connected GitHub reads and isolated small writes can succeed while repeated REST and GraphQL writes are blocked by Replit's Cloudflare layer.

**Why:** Bulk blob uploads, grouped GraphQL commits, native-client writes, and slower incremental commits all produced the same HTML 403 response, while repository reads remained healthy.

**How to apply:** Do not treat successful reads as proof that a bulk publish will work. Verify the remote head after every write, exclude workspace-internal metadata, and prefer an authenticated native Git push when available.