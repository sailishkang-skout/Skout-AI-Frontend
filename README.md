# Skout AI — Frontend

Next.js web app for the Skout AI GTM platform.

## Stack

- **Next.js 14+** (App Router)
- **TypeScript**
- **Tailwind CSS** + shadcn-style components
- **TanStack Query** for server state

## Structure

```
src/
├── app/
│   ├── (dashboard)/          # Authenticated workspace shell
│   │   ├── prospects/search/ # Global corpus search (P0)
│   │   ├── lists/
│   │   ├── enrichment/
│   │   ├── sequences/
│   │   ├── inbox/
│   │   ├── deliverability/
│   │   ├── ai/review/
│   │   ├── analytics/
│   │   └── settings/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                   # Base UI primitives
│   └── workspace/            # Shell, sidebar, nav
├── lib/                      # API client, utilities
└── types/                    # API types (mirror backend shared pkg)
```

## Getting started

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Prospect search calls the backend at `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).

## Pre-commit hooks

Husky runs unit tests before each commit (`npm test` → vitest). Hooks install automatically via `npm install` (`prepare` script). Requires a git repo — run `git init` if cloning fresh files without `.git`.

## Related repo

Backend API: `Skout AI Backend` monorepo (`apps/api`).

## Docker (local)

Requires the backend API on port **3001** (run `pnpm docker:local` in `Skout AI Backend` first).

```bash
npm run docker:local
# or
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Open [http://localhost:3000](http://localhost:3000). Client-side API calls use `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).

## Deploy

| Environment | How |
| --- | --- |
| **Local** | `npm run dev` or `npm run docker:local` |
| **Dev / Prod** | GitHub Actions builds Docker image → AWS ECR → ECS (see backend `infra/README.md`) |

AWS CDK and CI/CD pipelines live in the **Skout AI Backend** repo (`infra/`, `.github/workflows/deploy-*.yml`).
