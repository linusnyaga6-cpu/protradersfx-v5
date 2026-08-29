# ProTraders FX

Deriv-connected trading workspace backend with PKCE login, account proxying, controlled manual trading, and analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Production schema changes are synchronized by Replit Publish: it diffs the exported Drizzle schema and applies the reviewed change during publish. Do not run custom production migrations or startup-time DDL.
- Required production env: `BASE_URL`, `SESSION_SECRET`, `DERIV_CLIENT_ID`, and `DERIV_PUBLIC_APP_ID`
- Persistence accepts either `DATABASE_URL` or Vercel's `POSTGRES_URL` and can point to any standard PostgreSQL provider; public pages, health, OAuth, accounts, and live markets remain available when persistence is intentionally omitted
- Optional signup env: `DERIV_AFFILIATE_TOKEN` plus the affiliate UTM settings
- Optional cross-origin clients must be explicitly allowlisted with `ALLOWED_ORIGINS`; the web app is same-origin by default
- Trading remains disabled unless `TRADING_ENABLED=true`; demo-only mode is the default
- Real-money execution additionally requires `TRADING_LIVE_ENABLED=true`, `TRADING_DEMO_ONLY=false`, a non-empty `TRADING_ALLOWED_SYMBOLS` allowlist, and a passing preflight

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 with Helmet, rate limiting, and Deriv WebSocket requests
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/protraders.ts` — Deriv OAuth, session, account, trade, bot, analytics, and preflight routes
- `artifacts/api-server/src/app.ts` — API middleware and route mounting
- `vercel.json` — Vercel function entrypoint and catch-all routing

## Architecture decisions

- OAuth state is encrypted and bound to a short-lived, HttpOnly browser cookie to prevent login CSRF.
- Access tokens stay in an encrypted HttpOnly cookie and are refreshed server-side when possible.
- Trading is opt-in, demo-only by default, and bounded by stake, duration, and symbol limits; real-money execution has a separate explicit gate.
- Analytics never invents funded-account or P&L values; partner metrics must come from Deriv Partner Hub.

## Product

This project contains the production API, deployment wiring, and the ProTraders FX web frontend. The API reports frontend readiness as true unless `FRONTEND_CONFIGURED=false` is explicitly set.
ProTraders FX is an affiliated, Deriv-account-connected trading website intended to function through authenticated trading accounts; it is not an education-only page. Educational explanations and risk disclosures may support the product, but must not replace account-linked functionality.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Register `https://www.protradersfx.com/oauth/callback` exactly in Deriv and set `BASE_URL=https://www.protradersfx.com`.
- Analytics in the API service is in-memory/ephemeral; it does not write to the deployment filesystem and is not a durable source of business metrics.
- Do not enable real-money trading until the controlled demo test and independent risk review pass. TraderScheme is an external, unaffiliated reference only.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
