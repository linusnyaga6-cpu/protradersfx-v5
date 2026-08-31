---
name: GitHub tree completeness
description: Prevent Vercel builds from missing tracked files when publishing workspace changes through a GitHub API tree commit.
---

When publishing through the GitHub Git Data API, a commit built from a partial file list can be valid but still omit tracked files that exist locally. Vercel then clones the remote tree and may fail with an ENOENT import even though the local build succeeds.

**Why:** The GitHub tree, not the workspace checkout, is the source Vercel builds from.

**How to apply:** Base the API commit on the current remote branch tree, preserve unchanged entries, and explicitly compare or restore any tracked files that the remote tree lacks before waiting for Vercel.