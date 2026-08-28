# ProTraders FX

Deriv-connected trading workspace backend with PKCE login, account proxying, controlled manual trading, and analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required production env: `BASE_URL`, `SESSION_SECRET`, `DERIV_CLIENT_ID`, and `DERIV_PUBLIC_APP_ID`
- Optional signup env: `DERIV_AFFILIATE_TOKEN` plus the affiliate UTM settings
- Trading remains disabled unless `TRADING_ENABLED=true`; demo-only mode is the default

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
- Trading is opt-in, demo-only by default, and bounded by stake, duration, and optional symbol limits.
- Analytics never invents funded-account or P&L values; partner metrics must come from Deriv Partner Hub.

## Product

This project currently contains the production API and deployment wiring. The uploaded source did not include the original `public/` frontend assets, so the API reports frontend readiness as false until those files are restored.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Register `https://protradersfx.com/oauth/callback` exactly in Deriv and set the same value through `BASE_URL`.
- Analytics in the API service is in-memory/ephemeral; it is not a durable source of business metrics.
- Do not enable real-money trading until the controlled demo test and independent risk review pass.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
