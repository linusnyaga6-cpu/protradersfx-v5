---
name: Custom domain routing
description: How to distinguish a Replit deployment failure from an external custom-domain routing failure.
---

When a published app works at its generated Replit URL but the custom hostname returns a provider-specific error, treat DNS/provider routing as the primary fault domain.

**Why:** The custom hostname can continue serving an older Vercel function even while the current Replit deployment is healthy and correctly configured.

**How to apply:** Compare the generated deployment URL and custom hostname, inspect DNS targets and the HTTP `Server` header, and only debug application code after the custom hostname reaches Replit.