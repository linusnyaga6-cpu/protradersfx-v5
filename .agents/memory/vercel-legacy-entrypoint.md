---
name: Vercel legacy entrypoint diagnosis
description: How to interpret Vercel server.js syntax errors when the current repository uses a different serverless entrypoint
---

When Vercel reports a syntax error in `/var/task/server.js` but the current repository has no tracked root `server.js`, inspect the parent/legacy tree and linked Vercel project settings before changing application behavior. A malformed regex such as `replace(//+$/, "")` is parsed as a line comment; the parser often reports the next string literal (for example `"/oauth/callback"`) as the missing-parenthesis location.

**Why:** Vercel projects can remain linked to older entrypoint settings while GitHub `main` has moved to a monorepo TypeScript entrypoint, and blindly restoring a legacy server can introduce unrelated stale code.

**How to apply:** Compare the exact failing legacy file with the canonical OAuth source, make only the escaped-slash correction when it is the reported defect, and verify the generated current entrypoint plus Vercel routing before committing.