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

## Deploy

Vercel (recommended for MVP) — see [04-technology-stack](docs) for scale path.
