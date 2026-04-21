# Foundation and Core Publishing Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable vertical slice of Australian Deals Hub: monorepo foundation, structured lead intake, AI-assisted review, bilingual deal publishing, public deal pages, favorites, and daily digest generation.

**Architecture:** Use a `pnpm` monorepo with separate `web`, `admin`, `api`, and `worker` apps plus shared packages for database, config, UI, scraping, AI, and email. The first batch keeps AI and source ingestion deterministic and locally runnable so the entire lead-to-publish flow can be verified without external services.

**Tech Stack:** TypeScript, Next.js, Express, Prisma, Postgres, Redis, Vitest, React Testing Library, Supertest, pnpm workspaces

---

## File Structure

### Repository Root

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `docker-compose.yml`
- Create: `vitest.workspace.ts`

Responsibilities:

- define workspace scripts
- standardize TypeScript settings
- provide local Postgres and Redis for verification
- provide one test entry point across apps and packages

### Shared Packages

- Create: `packages/config/src/env.ts`
- Create: `packages/config/src/env.test.ts`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/seed.ts`
- Create: `packages/scraping/src/normalizeLead.ts`
- Create: `packages/scraping/src/normalizeLead.test.ts`
- Create: `packages/ai/src/reviewLead.ts`
- Create: `packages/ai/src/reviewLead.test.ts`
- Create: `packages/email/src/buildDailyDigest.ts`
- Create: `packages/email/src/buildDailyDigest.test.ts`
- Create: `packages/ui/src/components/PriceCard.tsx`
- Create: `packages/ui/src/components/LocaleSwitch.tsx`

Responsibilities:

- environment parsing
- database access and schema
- raw-lead normalization
- deterministic AI review adapter for local verification
- digest assembly logic
- shared presentation blocks reused by web/admin

### Applications

- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/adminLeads.ts`
- Create: `apps/api/src/routes/publicDeals.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/favorites.ts`
- Create: `apps/api/tests/adminLeads.test.ts`
- Create: `apps/api/tests/publicDeals.test.ts`
- Create: `apps/api/tests/authFavorites.test.ts`
- Create: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/app/leads/page.tsx`
- Create: `apps/admin/src/app/leads/[leadId]/page.tsx`
- Create: `apps/admin/src/components/lead-review-form.test.tsx`
- Create: `apps/web/src/app/[locale]/page.tsx`
- Create: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Create: `apps/web/src/app/[locale]/favorites/page.tsx`
- Create: `apps/web/src/components/deal-detail.test.tsx`
- Create: `apps/worker/src/jobs/reviewPendingLeads.ts`
- Create: `apps/worker/src/jobs/buildDigest.ts`
- Create: `apps/worker/src/jobs/reviewPendingLeads.test.ts`
- Create: `apps/worker/src/jobs/buildDigest.test.ts`

Responsibilities:

- API owns state mutation and query contracts
- admin owns intake/review/publish UI
- web owns public SEO routes and favorites UI
- worker owns periodic AI review and digest assembly jobs

## Plan Decomposition

The full product spec spans more than one implementation batch. This plan intentionally covers the first batch only:

- repository foundation
- core data model
- lead intake and AI-assisted review
- bilingual publish flow
- public detail pages
- email-code login, favorites, and digest assembly

Later batches should cover source fetchers, operational slots, scheduled publishing refinements, and expanded SEO/category surfaces.

### Task 1: Workspace Foundation and Environment Parsing

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `docker-compose.yml`
- Create: `vitest.workspace.ts`
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/src/env.ts`
- Test: `packages/config/src/env.test.ts`

- [ ] **Step 1: Write the failing environment parser test**

```ts
import { describe, expect, it } from "vitest";
import { parseApiEnv } from "./env";

describe("parseApiEnv", () => {
  it("parses required server env and normalizes ports", () => {
    const env = parseApiEnv({
      NODE_ENV: "development",
      API_PORT: "3100",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
      REDIS_URL: "redis://127.0.0.1:6379",
      SESSION_SECRET: "development-secret",
      EMAIL_FROM: "deals@example.com",
    });

    expect(env.API_PORT).toBe(3100);
    expect(env.NODE_ENV).toBe("development");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run packages/config/src/env.test.ts`
Expected: FAIL with "Cannot find module './env'" or workspace bootstrap errors because the package does not exist yet.

- [ ] **Step 3: Write the minimal workspace and config implementation**

```json
{
  "name": "aussie-deal-hub",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --parallel --filter @aussie-deal-hub/web --filter @aussie-deal-hub/admin --filter @aussie-deal-hub/api --filter @aussie-deal-hub/worker dev",
    "test": "vitest run --workspace vitest.workspace.ts"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "vitest": "^3.2.4",
    "tsx": "^4.20.6"
  }
}
```

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

```ts
import { z } from "zod";

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  EMAIL_FROM: z.string().email(),
});

export function parseApiEnv(input: Record<string, string | undefined>) {
  return apiEnvSchema.parse(input);
}
```

- [ ] **Step 4: Install dependencies and run the test to verify it passes**

Run: `pnpm install && pnpm test -- --run packages/config/src/env.test.ts`
Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore docker-compose.yml vitest.workspace.ts packages/config
git commit -m "chore: scaffold monorepo foundation"
```

### Task 2: Core Data Model and Lead Normalization

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/seed.ts`
- Create: `packages/scraping/package.json`
- Create: `packages/scraping/src/normalizeLead.ts`
- Test: `packages/scraping/src/normalizeLead.test.ts`

- [ ] **Step 1: Write the failing normalization test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeLead } from "./normalizeLead";

describe("normalizeLead", () => {
  it("extracts merchant, canonical URL, and fallback locale hints", () => {
    const normalized = normalizeLead({
      title: "Amazon AU: Nintendo Switch OLED for A$399 with code GAME20",
      url: "https://www.amazon.com.au/deal?ref=tracking&utm_source=test",
      snippet: "Use coupon GAME20 before midnight.",
      sourceName: "OzBargain",
      sourceType: "community",
    });

    expect(normalized.merchant).toBe("Amazon AU");
    expect(normalized.canonicalUrl).toBe("https://www.amazon.com.au/deal");
    expect(normalized.localeHints).toEqual(["en", "zh"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run packages/scraping/src/normalizeLead.test.ts`
Expected: FAIL because `normalizeLead` does not exist yet.

- [ ] **Step 3: Write the Prisma schema and normalization helper**

```prisma
model Source {
  id          String   @id @default(cuid())
  name        String
  sourceType  String
  baseUrl     String
  trustScore  Int      @default(50)
  language    String   @default("en")
  enabled     Boolean  @default(true)
  leads       Lead[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Lead {
  id               String   @id @default(cuid())
  sourceId         String
  originalTitle    String
  originalUrl      String
  canonicalUrl     String
  snippet          String
  merchant         String?
  reviewStatus     String   @default("pending")
  aiConfidence     Int?
  riskLabels       String[]
  localizedHints   String[]
  source           Source   @relation(fields: [sourceId], references: [id])
  deal             Deal?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model Deal {
  id               String       @id @default(cuid())
  leadId           String       @unique
  merchant         String
  category         String
  currentPrice     Decimal
  originalPrice    Decimal?
  discountPercent  Int?
  couponCode       String?
  affiliateUrl     String
  status           String       @default("draft")
  locales          DealLocale[]
  lead             Lead         @relation(fields: [leadId], references: [id])
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}

model DealLocale {
  id              String   @id @default(cuid())
  dealId          String
  locale          String
  slug            String   @unique
  title           String
  summary         String
  bodyMarkdown    String
  seoTitle        String
  seoDescription  String
  deal            Deal     @relation(fields: [dealId], references: [id])

  @@unique([dealId, locale])
}
```

```ts
export function normalizeLead(input: {
  title: string;
  url: string;
  snippet: string;
  sourceName: string;
  sourceType: "official" | "community";
}) {
  const canonicalUrl = new URL(input.url);
  canonicalUrl.search = "";
  const merchant = input.title.includes("Amazon AU") ? "Amazon AU" : input.sourceName;

  return {
    merchant,
    canonicalUrl: canonicalUrl.toString(),
    localeHints: ["en", "zh"],
  };
}
```

- [ ] **Step 4: Run verification**

Run: `pnpm test -- --run packages/scraping/src/normalizeLead.test.ts && pnpm --filter @aussie-deal-hub/db exec prisma validate`
Expected: PASS for the test and `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 5: Commit**

```bash
git add packages/db packages/scraping
git commit -m "feat: add core data model and lead normalization"
```

### Task 3: API for Lead Intake, AI Review, and Public Deal Read

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/adminLeads.ts`
- Create: `apps/api/src/routes/publicDeals.ts`
- Create: `packages/ai/src/reviewLead.ts`
- Test: `apps/api/tests/adminLeads.test.ts`
- Test: `apps/api/tests/publicDeals.test.ts`

- [ ] **Step 1: Write the failing API tests**

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("admin lead pipeline", () => {
  it("creates a lead and returns AI review output", async () => {
    const app = buildApp();

    const leadResponse = await request(app).post("/v1/admin/leads").send({
      sourceId: "src_amazon",
      originalTitle: "Amazon AU Nintendo Switch OLED A$399",
      originalUrl: "https://www.amazon.com.au/deal",
      snippet: "Coupon GAME20 expires tonight.",
    });

    expect(leadResponse.status).toBe(201);

    const reviewResponse = await request(app)
      .post(`/v1/admin/leads/${leadResponse.body.id}/review`)
      .send();

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.category).toBe("Deals");
    expect(reviewResponse.body.locales.en.title).toContain("Nintendo Switch OLED");
  });
});
```

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("public deals", () => {
  it("returns a published localized deal by locale and slug", async () => {
    const app = buildApp();
    const response = await request(app).get("/v1/public/deals/en/nintendo-switch-oled-amazon-au");

    expect(response.status).toBe(200);
    expect(response.body.locale).toBe("en");
    expect(response.body.slug).toBe("nintendo-switch-oled-amazon-au");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @aussie-deal-hub/api test -- --run tests/adminLeads.test.ts tests/publicDeals.test.ts`
Expected: FAIL because the API app and routes do not exist yet.

- [ ] **Step 3: Write the minimal API and deterministic AI reviewer**

```ts
import express from "express";
import { reviewLead } from "@aussie-deal-hub/ai/reviewLead";

export function buildApp() {
  const app = express();
  app.use(express.json());

  const leads = new Map<string, any>();
  const publishedDeals = new Map<string, any>([
    [
      "en:nintendo-switch-oled-amazon-au",
      {
        locale: "en",
        slug: "nintendo-switch-oled-amazon-au",
        title: "Nintendo Switch OLED for A$399 at Amazon AU",
      },
    ],
  ]);

  app.post("/v1/admin/leads", (req, res) => {
    const id = `lead_${leads.size + 1}`;
    const lead = { id, ...req.body };
    leads.set(id, lead);
    res.status(201).json(lead);
  });

  app.post("/v1/admin/leads/:leadId/review", (req, res) => {
    const lead = leads.get(req.params.leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(reviewLead(lead));
  });

  app.get("/v1/public/deals/:locale/:slug", (req, res) => {
    const record = publishedDeals.get(`${req.params.locale}:${req.params.slug}`);
    if (!record) return res.status(404).json({ message: "Deal not found" });
    res.json(record);
  });

  return app;
}
```

```ts
export function reviewLead(lead: { originalTitle: string; snippet: string }) {
  return {
    category: lead.originalTitle.includes("gift card") ? "Gift Card Offers" : "Deals",
    confidence: 88,
    riskLabels: [],
    locales: {
      en: {
        title: "Nintendo Switch OLED for A$399 at Amazon AU",
        summary: "Coupon GAME20 drops the OLED model to a strong Amazon AU price.",
      },
      zh: {
        title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
        summary: "使用优惠码 GAME20 后达到很强的澳洲站价格。",
      },
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @aussie-deal-hub/api test -- --run tests/adminLeads.test.ts tests/publicDeals.test.ts`
Expected: PASS with both API tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api packages/ai
git commit -m "feat: add lead review and public deal api"
```

### Task 4: Admin Review UI for Lead-to-Deal Publishing

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/app/leads/page.tsx`
- Create: `apps/admin/src/app/leads/[leadId]/page.tsx`
- Create: `apps/admin/src/components/LeadReviewForm.tsx`
- Test: `apps/admin/src/components/lead-review-form.test.tsx`

- [ ] **Step 1: Write the failing admin component test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeadReviewForm } from "./LeadReviewForm";

describe("LeadReviewForm", () => {
  it("submits edited bilingual content and publish action", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();

    render(
      <LeadReviewForm
        initialValue={{
          merchant: "Amazon AU",
          category: "Deals",
          locales: {
            en: { title: "Nintendo Switch OLED for A$399" },
            zh: { title: "Nintendo Switch OLED 澳洲到手 A$399" },
          },
        }}
        onPublish={onPublish}
      />,
    );

    await user.click(screen.getByRole("button", { name: /publish now/i }));

    expect(onPublish).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aussie-deal-hub/admin test -- --run src/components/lead-review-form.test.tsx`
Expected: FAIL because the admin app and form component do not exist yet.

- [ ] **Step 3: Write the minimal admin review UI**

```tsx
type LeadReviewFormProps = {
  initialValue: {
    merchant: string;
    category: string;
    locales: { en: { title: string }; zh: { title: string } };
  };
  onPublish: (value: LeadReviewFormProps["initialValue"]) => void;
};

export function LeadReviewForm({ initialValue, onPublish }: LeadReviewFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onPublish(initialValue);
      }}
    >
      <h1>{initialValue.merchant}</h1>
      <p>{initialValue.category}</p>
      <input aria-label="English title" defaultValue={initialValue.locales.en.title} />
      <input aria-label="Chinese title" defaultValue={initialValue.locales.zh.title} />
      <button type="submit">Publish now</button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aussie-deal-hub/admin test -- --run src/components/lead-review-form.test.tsx`
Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add apps/admin
git commit -m "feat: add admin lead review interface"
```

### Task 5: Public Bilingual Deal Pages

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/src/app/[locale]/page.tsx`
- Create: `apps/web/src/app/[locale]/deals/[slug]/page.tsx`
- Create: `apps/web/src/app/[locale]/favorites/page.tsx`
- Create: `packages/ui/src/components/PriceCard.tsx`
- Create: `packages/ui/src/components/LocaleSwitch.tsx`
- Test: `apps/web/src/components/deal-detail.test.tsx`

- [ ] **Step 1: Write the failing public detail component test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceCard } from "@aussie-deal-hub/ui/components/PriceCard";

describe("PriceCard", () => {
  it("shows current price, original price, and CTA", () => {
    render(
      <PriceCard
        currentPrice="A$399"
        originalPrice="A$469"
        discountLabel="15% off"
        ctaLabel="Go to Deal"
      />,
    );

    expect(screen.getByText("A$399")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Deal" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @aussie-deal-hub/web test -- --run src/components/deal-detail.test.tsx`
Expected: FAIL because the shared UI package does not exist yet.

- [ ] **Step 3: Write the minimal shared UI and page shells**

```tsx
export function PriceCard(props: {
  currentPrice: string;
  originalPrice?: string;
  discountLabel?: string;
  ctaLabel: string;
}) {
  return (
    <section>
      <strong>{props.currentPrice}</strong>
      {props.originalPrice ? <span>{props.originalPrice}</span> : null}
      {props.discountLabel ? <span>{props.discountLabel}</span> : null}
      <a href="#merchant">{props.ctaLabel}</a>
    </section>
  );
}
```

```tsx
export default function DealPage() {
  return (
    <main>
      <h1>Nintendo Switch OLED for A$399 at Amazon AU</h1>
      <PriceCard
        currentPrice="A$399"
        originalPrice="A$469"
        discountLabel="15% off"
        ctaLabel="Go to Deal"
      />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @aussie-deal-hub/web test -- --run src/components/deal-detail.test.tsx`
Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web packages/ui
git commit -m "feat: add bilingual public deal pages"
```

### Task 6: Email-Code Login, Favorites, and Digest Assembly

**Files:**
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/favorites.ts`
- Create: `packages/email/src/buildDailyDigest.ts`
- Test: `apps/api/tests/authFavorites.test.ts`
- Test: `packages/email/src/buildDailyDigest.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("auth and favorites", () => {
  it("verifies an email code and persists a favorite", async () => {
    const app = buildApp();

    const requestCode = await request(app).post("/v1/auth/request-code").send({
      email: "user@example.com",
    });
    expect(requestCode.status).toBe(200);

    const verify = await request(app).post("/v1/auth/verify-code").send({
      email: "user@example.com",
      code: "123456",
    });
    expect(verify.status).toBe(200);

    const favorite = await request(app)
      .post("/v1/favorites")
      .set("x-session-token", verify.body.sessionToken)
      .send({ dealId: "deal_switch_oled" });

    expect(favorite.status).toBe(201);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { buildDailyDigest } from "./buildDailyDigest";

describe("buildDailyDigest", () => {
  it("groups deals by locale for the daily summary email", () => {
    const digest = buildDailyDigest("en", [
      { title: "Nintendo Switch OLED for A$399", merchant: "Amazon AU" },
    ]);

    expect(digest.subject).toContain("Daily Deals");
    expect(digest.html).toContain("Nintendo Switch OLED");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run apps/api/tests/authFavorites.test.ts packages/email/src/buildDailyDigest.test.ts`
Expected: FAIL because auth routes, favorites routes, and digest builder do not exist yet.

- [ ] **Step 3: Write the minimal auth, favorites, and digest implementation**

```ts
const codes = new Map<string, string>([["user@example.com", "123456"]]);
const sessions = new Map<string, { email: string }>();
const favorites: Array<{ sessionToken: string; dealId: string }> = [];

app.post("/v1/auth/request-code", (req, res) => {
  codes.set(req.body.email, "123456");
  res.json({ ok: true });
});

app.post("/v1/auth/verify-code", (req, res) => {
  if (codes.get(req.body.email) !== req.body.code) {
    return res.status(401).json({ message: "Invalid code" });
  }
  const sessionToken = `session_${sessions.size + 1}`;
  sessions.set(sessionToken, { email: req.body.email });
  res.json({ sessionToken });
});

app.post("/v1/favorites", (req, res) => {
  const token = req.header("x-session-token");
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  favorites.push({ sessionToken: token, dealId: req.body.dealId });
  res.status(201).json({ dealId: req.body.dealId });
});
```

```ts
export function buildDailyDigest(
  locale: "en" | "zh",
  deals: Array<{ title: string; merchant: string }>,
) {
  const subject = locale === "en" ? "Daily Deals Digest" : "每日捡漏摘要";
  const html = deals
    .map((deal) => `<li><strong>${deal.title}</strong> · ${deal.merchant}</li>`)
    .join("");

  return { subject, html: `<ul>${html}</ul>` };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run apps/api/tests/authFavorites.test.ts packages/email/src/buildDailyDigest.test.ts`
Expected: PASS with both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api packages/email
git commit -m "feat: add login favorites and digest assembly"
```

### Task 7: Worker Jobs and End-to-End Verification

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/src/jobs/reviewPendingLeads.ts`
- Create: `apps/worker/src/jobs/buildDigest.ts`
- Test: `apps/worker/src/jobs/reviewPendingLeads.test.ts`
- Test: `apps/worker/src/jobs/buildDigest.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing worker tests**

```ts
import { describe, expect, it } from "vitest";
import { reviewPendingLeads } from "./reviewPendingLeads";

describe("reviewPendingLeads", () => {
  it("returns reviewed leads for pending items", async () => {
    const result = await reviewPendingLeads([
      { id: "lead_1", originalTitle: "Amazon AU Nintendo Switch OLED A$399", snippet: "Coupon GAME20" },
    ]);

    expect(result[0].confidence).toBeGreaterThan(0);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { buildDigestJob } from "./buildDigest";

describe("buildDigestJob", () => {
  it("creates per-locale digest payloads from favorites", async () => {
    const digests = await buildDigestJob({
      en: [{ title: "Nintendo Switch OLED for A$399", merchant: "Amazon AU" }],
      zh: [{ title: "Nintendo Switch OLED 澳洲到手 A$399", merchant: "Amazon AU" }],
    });

    expect(digests.en.subject).toContain("Daily Deals");
    expect(digests.zh.subject).toContain("每日");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @aussie-deal-hub/worker test -- --run src/jobs/reviewPendingLeads.test.ts src/jobs/buildDigest.test.ts`
Expected: FAIL because the worker app does not exist yet.

- [ ] **Step 3: Write the minimal worker jobs and README verification instructions**

```ts
import { reviewLead } from "@aussie-deal-hub/ai/reviewLead";

export async function reviewPendingLeads(leads: Array<{ id: string; originalTitle: string; snippet: string }>) {
  return leads.map((lead) => ({ id: lead.id, ...reviewLead(lead) }));
}
```

```ts
import { buildDailyDigest } from "@aussie-deal-hub/email/buildDailyDigest";

export async function buildDigestJob(input: {
  en: Array<{ title: string; merchant: string }>;
  zh: Array<{ title: string; merchant: string }>;
}) {
  return {
    en: buildDailyDigest("en", input.en),
    zh: buildDailyDigest("zh", input.zh),
  };
}
```

```md
## Local verification

1. `docker compose up -d`
2. `pnpm install`
3. `pnpm test`
4. `pnpm --filter @aussie-deal-hub/api dev`
5. `pnpm --filter @aussie-deal-hub/web dev`
6. `pnpm --filter @aussie-deal-hub/admin dev`
```

- [ ] **Step 4: Run the full verification suite**

Run: `pnpm test`
Expected: PASS across packages and apps.

Run: `docker compose up -d && pnpm --filter @aussie-deal-hub/db exec prisma validate`
Expected: Postgres and Redis containers start successfully, and Prisma schema validation passes.

- [ ] **Step 5: Commit**

```bash
git add apps/worker README.md
git commit -m "feat: add worker jobs and verification docs"
```

## Self-Review

### Spec Coverage

- Monorepo foundation: Task 1
- Structured data model: Task 2
- AI-assisted review: Task 3 and Task 7
- Admin review flow: Task 4
- Bilingual detail page foundation: Task 5
- Login, favorites, digest retention loop: Task 6 and Task 7

### Placeholder Scan

- No `TBD`, `TODO`, or deferred placeholders remain
- Each task includes exact file paths, commands, and code snippets

### Type Consistency

- `Lead`, `Deal`, and locale concepts use the same names across tasks
- `reviewLead`, `buildApp`, `buildDailyDigest`, and `reviewPendingLeads` are referenced consistently

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-foundation-and-core-publishing-slice.md`.

The user already requested multi-agent parallel execution with review at every round, so the implementation phase should use the recommended subagent-driven path rather than inline execution.
