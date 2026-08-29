---
name: Mockup sandbox production builds
description: Prevent the design preview package from blocking root production builds.
---

Mockup-sandbox Vite configuration must provide safe build-time defaults for workflow-provided values such as `PORT` and `BASE_PATH`.

**Why:** Replit publishing may run the workspace root build, which includes the design package outside its configured preview workflow. Runtime-only environment validation can therefore fail before the product artifacts build.

**How to apply:** Keep strict runtime routing through artifact configuration, but ensure static build commands can load Vite config without workflow environment variables. Validate publishing changes with the complete root build, not only product artifact builds.