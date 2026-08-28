---
name: API codegen barrel collision
description: The generated Zod barrel can re-export query parameter types that collide with generated runtime schemas.
---

Do not wildcard-export generated runtime validation schemas and generated TypeScript types from the same public barrel when they can share names; expose the types through a namespace instead.

**Why:** The current Orval setup can emit both a Zod schema and a TypeScript type with the same public name, causing the workspace library typecheck to fail after otherwise valid code generation.

**How to apply:** Preserve runtime-schema exports and namespaced type access rather than weakening validation or hand-writing endpoint schemas.