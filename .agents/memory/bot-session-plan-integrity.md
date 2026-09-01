---
name: Bot session plan integrity
description: Configurable bot controls must remain part of the reviewed, signed execution plan.
---

Every bot setting that changes bounded-session behavior—stake progression, exposure ceilings, or stop guards—must be validated against the saved bot and included in the signed proposal-plan comparison.

**Why:** A UI-only setting can appear saved while the execution request still uses a different or unreviewed plan, weakening risk controls or causing proposal mismatches.

**How to apply:** When adding a bot control, update storage validation, client session behavior, preview validation, signed-token fields, and execution-time matching together; keep monitor-only bots excluded from execution.