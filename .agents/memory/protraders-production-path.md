---
name: ProTraders production path
description: The authorized GitHub-to-Vercel production path and safe commit reconciliation rule.
---

The production source of truth is the GitHub repository `linusnyaga6-cpu/protradersfx-v5`, branch `main`, linked to the existing Vercel project `protradersfx-v5`; the public domain is `www.protradersfx.com`.

**Why:** The Replit checkout and GitHub `main` can have different local commit histories even when the workspace is clean. Force-pushing the local branch could remove production source that exists only on GitHub.

**How to apply:** Compare tracked file content with the remote tree, exclude workspace-only metadata/assets, create a normal commit against the current remote `main` parent through the authorized GitHub connection, and let the linked Vercel project build that commit.

**Additional constraint:** Shell Git pushes may not have a usable GitHub credential in this workspace; the authorized GitHub connection's REST file update can publish source changes without force-pushing.

**Why:** A normal shell push was rejected for missing credentials even though the connected GitHub integration had write access.

**How to apply:** Use the connected GitHub API for the exact source files when shell authentication is unavailable, then verify the linked Vercel deployment commit and readiness endpoints.

**Verification note:** Replit deployment metadata can report a separate or stale deployment state even while the linked Vercel build is live.

**Why:** The authoritative production build for this app is the Vercel deployment attached to the GitHub repository, not the Replit deployment record.

**How to apply:** Confirm the Vercel deployment commit matches GitHub `main`, its state is `READY`, and the custom host returns HTTP 200 before declaring production healthy.