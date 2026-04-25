FROM node:22-slim AS workspace

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @aussie-deal-hub/db prisma:generate
RUN ./node_modules/.bin/tsc -p packages/config/tsconfig.json \
  && ./node_modules/.bin/tsc --noEmit --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --strict --esModuleInterop --forceConsistentCasingInFileNames --skipLibCheck --resolveJsonModule --allowSyntheticDefaultImports packages/ai/src/reviewLead.ts \
  && ./node_modules/.bin/tsc --noEmit --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --strict --esModuleInterop --forceConsistentCasingInFileNames --skipLibCheck --resolveJsonModule --allowSyntheticDefaultImports packages/scraping/src/normalizeLead.ts packages/scraping/src/extractLeadCandidates.ts \
  && temp_config="$(mktemp /tmp/aussie-deal-hub-ui-build-XXXXXX.json)" \
  && printf '%s' '{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","strict":true,"skipLibCheck":true,"jsx":"react-jsx","noEmit":true,"baseUrl":"/app","paths":{"react":["apps/web/node_modules/@types/react/index.d.ts"],"react/jsx-runtime":["apps/web/node_modules/@types/react/jsx-runtime.d.ts"]}},"files":["/app/packages/ui/src/components/LocaleSwitch.tsx","/app/packages/ui/src/components/PriceCard.tsx"]}' > "$temp_config" \
  && ./node_modules/.bin/tsc -p "$temp_config" \
  && rm -f "$temp_config" \
  && ./node_modules/.bin/tsc --noEmit --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --strict --esModuleInterop --forceConsistentCasingInFileNames --skipLibCheck --resolveJsonModule --allowSyntheticDefaultImports packages/email/src/buildDailyDigest.ts \
  && DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub \
     node "$(node -p "require.resolve('prisma/build/index.js', { paths: ['./packages/db'] })")" \
     validate --schema packages/db/prisma/schema.prisma \
  && ./node_modules/.bin/tsc --noEmit --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --strict --esModuleInterop --forceConsistentCasingInFileNames --skipLibCheck --resolveJsonModule --allowSyntheticDefaultImports apps/api/src/index.ts \
  && ./node_modules/.bin/tsc --noEmit --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --strict --esModuleInterop --forceConsistentCasingInFileNames --skipLibCheck --resolveJsonModule --allowSyntheticDefaultImports apps/worker/src/index.ts apps/worker/src/runtime.ts apps/worker/src/jobs/buildDigest.ts apps/worker/src/jobs/reviewPendingLeads.ts apps/worker/src/jobs/publishDueReviews.ts apps/worker/src/jobs/ingestEnabledSources.ts \
  && pnpm --filter @aussie-deal-hub/admin build \
  && pnpm --filter @aussie-deal-hub/web build

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

FROM workspace AS worker

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@aussie-deal-hub/worker", "start"]
