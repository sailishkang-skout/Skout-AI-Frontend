# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CRM_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG CLERK_SECRET_KEY
ARG GATE_TOKEN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Do not fall back to API URL — that breaks Clerk redirects / app origin.
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_CRM_API_URL=${NEXT_PUBLIC_CRM_API_URL}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY
ENV GATE_TOKEN=$GATE_TOKEN
# Edge middleware cannot read runtime env. Write a string literal (heredoc is
# quoted so the token does not appear in `docker history`) and fail the build
# if Next.js did not compile it into the middleware bundle.
RUN node <<'NODE'
const fs = require("fs");
const token = process.env.GATE_TOKEN || "";
fs.mkdirSync("src/lib", { recursive: true });
fs.writeFileSync(
  "src/lib/gate-token.generated.ts",
  "export const GATE_TOKEN_VALUE = " + JSON.stringify(token) + ";\n"
);
console.log(token ? "Access gate ENABLED for this image" : "WARNING: GATE_TOKEN is empty — /app access gate will be DISABLED");
NODE
RUN pnpm run build
RUN node <<'NODE'
const fs = require("fs");
const token = process.env.GATE_TOKEN || "";
if (!token) process.exit(0);
const middleware = fs.readFileSync(".next/server/src/middleware.js", "utf8");
if (!middleware.includes(token)) {
  console.error("GATE_TOKEN was not inlined into Edge middleware — refusing to ship an ungated image");
  process.exit(1);
}
console.log("Access gate confirmed in middleware bundle");
NODE

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG CLERK_SECRET_KEY
ARG GATE_TOKEN
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY
ENV GATE_TOKEN=$GATE_TOKEN
RUN addgroup -S skout && adduser -S skout -G skout
COPY --from=build /app/public ./public
COPY --from=build --chown=skout:skout /app/.next/standalone ./
COPY --from=build --chown=skout:skout /app/.next/static ./.next/static
USER skout
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/app || exit 1
CMD ["node", "server.js"]
