---
name: GitHub connector write throttling
description: An environment-specific limitation encountered when publishing many repository files through the connected GitHub API.
---

Connected GitHub reads and isolated small writes can succeed while repeated REST and GraphQL writes are blocked by Replit's Cloudflare layer.

**Why:** Bulk blob uploads, grouped GraphQL commits, native-client writes, and slower incremental commits all produced the same HTML 403 response, while repository reads remained healthy.

**How to apply:** Do not treat successful reads as proof that a bulk publish will work. Verify the remote head after every write, exclude workspace-internal metadata, and prefer an authenticated native Git push when available.

Workspace auto-commits can also include attached instruction files alongside source edits. Publish only the intended source files rather than pushing such a local commit wholesale.

**Why:** A local commit created during a source-only change included the user's attached instruction text, which was not part of the production artifact.

**How to apply:** Inspect the commit contents before publishing; use a file-scoped authenticated update when local history contains workspace-only attachments.

When the configured native Git remote rejects its credential, the connected GitHub client can still publish a file-scoped commit by creating a blob, tree, commit, and non-forced branch update through the repository Git API.

**Why:** The repository remote used an invalid Git credential while the connected GitHub authorization remained healthy.

**How to apply:** Read the current branch head first, make the remote head the commit parent, publish only intended paths, and verify the updated head before relying on Vercel.

The connector's REST proxy may reject dynamically assembled repository paths in the durable sandbox even when literal API paths work; the authenticated GitHub client avoids that validator.

**Why:** A file-scoped source publish hit the proxy pattern validator before making any GitHub change, while the native client completed the same blob/tree/commit flow.

**How to apply:** Prefer the connected GitHub client for multi-step Git Data API commits; keep paths and repository identifiers explicit and verify the resulting deployment commit.