# Skout AI — Frontend

Next.js web app for the Skout AI GTM platform.

## Tech stack

| Layer | Technology |
| --- | --- |
| **Framework** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling** | Tailwind CSS, shadcn-style UI components |
| **State** | TanStack Query (server state) |
| **Auth** | Clerk (`@clerk/nextjs`) |
| **API** | REST → backend `@skout/api` (Fastify) |
| **Observability** | `createClientLogger()` in `src/lib/logger.ts` (structured console; Sentry/PostHog optional) |
| **Deploy** | Docker → AWS ECR → ECS (via backend CI/CD) |

## Structure

```
src/
├── app/
│   ├── (dashboard)/          # Authenticated workspace shell
│   │   ├── prospects/search/
│   │   ├── lists/
│   │   ├── enrichment/
│   │   ├── settings/crm/     # HubSpot connect + import
│   │   ├── settings/integrations/  # BYOK keys
│   │   └── …
│   ├── icon.tsx              # Favicon (generated)
│   └── layout.tsx
├── components/
├── lib/                      # api-client, crm, enrichment, logger
└── types/
```

## Getting started

```bash
cp .env.example .env.local     # fill keys — see below
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**Requires backend** on port 3001 — see `Skout AI Backend` README.

## Environment variables

| File | Purpose |
| --- | --- |
| `.env.local` | Your local keys (**gitignored**) |
| `.env.example` | Safe template (committed) |

| Variable | Required? | Where to get |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | `http://127.0.0.1:3001` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Yes | Same Clerk page |
| `NEXT_PUBLIC_WORKSPACE_ID` | Yes (demo) | `00000000-0000-4000-8000-000000000001` after `pnpm db:seed` |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | [Sentry](https://sentry.io) → Frontend project → Client Keys |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional | [PostHog](https://posthog.com) → Project API key |

## Test locally (with backend)

```bash
# Terminal 1 — backend
cd "../Skout AI Backend"
docker compose up -d postgres redis
pnpm dev

# Terminal 2 — frontend
pnpm dev
```

1. Sign in at [http://localhost:3000](http://localhost:3000)
2. Open browser DevTools → **Console** — client logs show as `[module] message`
3. Backend logs appear in Terminal 1 as JSON (see backend README § Observability)
4. CRM: **Settings → CRM** — connect HubSpot, test import
5. Favicon: check browser tab for blue **S** icon

## Observability

| What | Where |
| --- | --- |
| **API logs** | Backend terminal (local) or CloudWatch `/skout/dev/api` (AWS) |
| **Frontend logs** | Browser console (`createClientLogger`) |
| **Errors (prod)** | Sentry when `NEXT_PUBLIC_SENTRY_DSN` is set |
| **Analytics** | PostHog when `NEXT_PUBLIC_POSTHOG_KEY` is set |

Use the backend README for CloudWatch Logs Insights queries and full observability testing.

## Pre-commit hooks

```bash
pnpm test
```

Hooks install via `pnpm install` (husky).

## Related repo

Backend: **`Skout AI Backend`** (`apps/api`, `infra/`, deploy workflows).

## Docker (local)

Requires backend API on port **3001**.

```bash
pnpm run docker:local
```

## Deploy

| Environment | How |
| --- | --- |
| **Local** | `pnpm dev` |
| **Dev / Prod** | Push backend `develop` / `main` — CI builds web image → ECR → ECS |

AWS CDK and pipelines: backend `infra/README.md`.
