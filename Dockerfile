FROM node:22-slim AS workspace

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM workspace AS api

ENV NODE_ENV=production
EXPOSE 3001

CMD ["pnpm", "--filter", "@aussie-deal-hub/api", "start"]

FROM workspace AS web

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "--filter", "@aussie-deal-hub/web", "start"]

FROM workspace AS admin

ENV NODE_ENV=production
EXPOSE 3002

CMD ["pnpm", "--filter", "@aussie-deal-hub/admin", "start"]
