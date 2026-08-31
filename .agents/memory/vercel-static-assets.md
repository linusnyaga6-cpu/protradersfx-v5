---
name: Vercel static asset imports
description: Reliable delivery of critical frontend images in legacy monorepo Vercel deployments
---

Critical frontend images should be imported from the Vite source graph so the build emits a hashed asset under the application's working assets path; do not rely on a root-level public image rewrite when the project uses legacy monorepo routing.

**Why:** The source image existed in the GitHub tree, but the public `/images/...` request intermittently fell through to the SPA HTML fallback after later deployments. A Vite-imported image returned `200 image/jpeg` from the production alias.

**How to apply:** For hero or other required images, keep the source in the frontend asset graph and verify the emitted hashed URL directly in production after deployment.