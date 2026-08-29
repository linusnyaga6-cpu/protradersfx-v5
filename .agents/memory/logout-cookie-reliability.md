---
name: Logout cookie reliability
description: Browser logout behavior for the authenticated ProTraders workspace
---

The browser logout path should make an explicit same-origin request with `credentials: "include"`, then redirect even when the request reports an error. The API should clear the session cookie with both an expired cookie value and matching path/options, and send `Cache-Control: no-store`.

**Why:** A mutation-only logout button produced no observable logout request in the proxied browser path, leaving the authenticated UI/session state appearing connected.

**How to apply:** Preserve this behavior when changing authentication, generated API clients, proxy routing, or the public/authenticated navigation.