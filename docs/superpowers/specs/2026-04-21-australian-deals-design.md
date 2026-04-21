# Australian Deals Hub Design

Date: 2026-04-21
Status: Approved for planning

## 1. Product Summary

Build a bilingual Australian bargain aggregation website from scratch. The product focuses on helping users discover worthwhile deals quickly, save interesting items, and return via daily email summaries.

The first release is not a community forum and not a marketplace. It is an editorially controlled deal aggregation platform with structured listings, strong detail-page conversion, and light user accounts.

## 2. Confirmed Product Decisions

- Product shape: information aggregation site
- Primary market: Australia
- Language strategy: bilingual with fully independent English and Chinese detail pages
- Content ingestion: semi-automated collection plus human review before publish
- First-release categories:
  - ecommerce discounts
  - historical lows / near historical lows
  - freebies
  - gift card offers
- User system: email one-time-code login
- Primary business objective: user retention first, affiliate conversion second
- Retention mechanism in v1: favorites plus daily email digest
- Source policy: official sources plus third-party community leads, both manually verified before publish
- Editorial depth in v1: operational curation including featured slots, tags, topics, and scheduled publishing
- Data-source breadth in v1: curated set of 8-12 high-value official sources plus 2-3 lead-discovery community sources
- Monetization priority in v1: affiliate outbound conversion

## 3. Reference Product Direction

The product may borrow the conversion logic of the `什么值得买` detail page, especially:

- strong price hierarchy
- strong discount signaling
- strong historical-low positioning
- strong outbound CTA
- strong related-deal cross-linking

The site must not copy that product's exact interface or code. The target visual language is cleaner, more international, and more controlled for bilingual SEO.

## 4. Goals

### User Goals

- Understand within seconds whether a deal is worth attention
- Save deals for later review
- Return through digest-driven retention
- Browse in English or Chinese without broken structure

### Business Goals

- Build a reusable editorial and data pipeline
- Support affiliate conversion from detail pages
- Grow a retained audience through favorites and daily email digests
- Create a GitHub-hosted codebase that can be iterated safely and continuously

## 5. Explicit Non-Goals for v1

Do not include these in the first release:

- comments, forums, front-end user submissions
- instant price-drop alerts
- browser push notifications
- paid subscriptions or memberships
- multi-reviewer approval workflows
- fully automated publishing
- site-wide automated price-history graphs
- second-hand marketplace deals
- enterprise liquidation / government disposals
- airfare mistake fares
- mobile apps or mini-programs

## 6. Information Architecture

### Public Site

Top-level route groups:

- `/en`
- `/zh`

Core public pages:

- homepage
- category listing pages
- search results page
- bilingual independent detail pages
- favorites page
- email preferences page
- login / verification flow
- recent views page

Homepage sections:

- hero search
- featured today
- historical lows / near historical lows
- freebies
- gift card offers
- latest deals
- trending merchants

Primary categories:

- Deals
- Historical Lows
- Freebies
- Gift Card Offers

Listing filters in v1:

- category
- merchant
- discount band
- historical-low status
- free-shipping status
- ending-soon status

### Detail Page Structure

The detail page is the primary conversion surface.

Above the fold:

- title
- hero image
- current price
- original price
- savings and discount
- historical-low / near-historical-low status
- merchant
- expiry window
- coupon code if required
- primary `Go to Deal` CTA
- secondary `Add to Favorites` CTA
- short "why this is worth it" summary

Mid-page modules:

- deal highlights
- price context
- how to get it
- terms and warnings

Lower-page modules:

- related deals
- gift-card stacking opportunities where relevant
- language switch to linked localized page

### User Area

Keep user account scope intentionally light:

- My Favorites
- Email Preferences
- Recent Views

No points, social graph, or complex alert center in v1.

### Admin

Separate admin application with these modules:

- Sources / Intake
- Leads
- AI Review
- Deal Editor
- Publishing / Featured Slots / Scheduling
- Merchant and Tag Management
- Daily Digest Management

## 7. Content and Data Flow

### Core Entities

- `Source`: source config, fetch method, trust score, language, schedule, enabled status
- `Lead`: raw captured lead with original title, URL, source snippet, snapshot, timestamps, and source score
- `Deal`: structured published object with price, original price, discount, currency, merchant, coupon, validity, category, tags, affiliate link, featured flags, and publish state
- `DealLocale`: localized content record for `en` and `zh`, each with title, summary, body, SEO title, SEO description, and slug
- `PriceSnapshot`: limited historical price record for selected merchants and selected products
- `Favorite`: user-to-deal relation
- `EmailDigestSubscription`: digest language, frequency, and category preferences

### Ingestion Pipeline

1. Source fetchers pull official pages and community lead pages into `Lead`
2. Rule-based normalization cleans URLs, identifies merchants, and performs basic de-duplication
3. AI review extracts structured fields, classifies the lead, creates bilingual drafts, and assigns risk/confidence scores
4. Editors review the source evidence and AI output in the admin UI
5. Editors publish immediately or schedule publication
6. Publishing generates linked `/en/...` and `/zh/...` detail pages
7. Favorites and digest jobs use published deals as retention inputs

## 8. AI-Assisted Collection and First Review

AI is an accelerator, not an autonomous publisher.

### AI Responsibilities in v1

- extract current price, original price, savings, coupon, validity, merchant, and product highlights
- classify into `Deals`, `Historical Lows`, `Freebies`, or `Gift Card Offers`
- generate editable English and Chinese draft content
- cluster near-duplicate leads
- assign risk labels such as:
  - likely expired
  - suspicious price anomaly
  - regional restriction
  - unstable inventory
  - weak source credibility
- assign a confidence score to support review queue ordering

### AI Restrictions

- AI must not auto-publish
- AI output must preserve raw evidence for editor review
- all published deals require explicit human action

## 9. Technical Architecture

### System Shape

Use a monorepo with four main applications:

- `apps/web`: public site
- `apps/admin`: editorial admin
- `apps/api`: backend API
- `apps/worker`: background jobs

Shared packages:

- `packages/db`
- `packages/ui`
- `packages/config`
- `packages/ai`
- `packages/scraping`
- `packages/email`

### Recommended Stack

- frontend applications: `Next.js` with TypeScript
- backend API: `Node.js` with TypeScript
- database: `Postgres`
- queue and cache: `Redis`
- ORM: `Prisma`
- email delivery: transactional email provider plus scheduled digest jobs
- background execution: worker processes for fetch, AI review, price snapshots, and digests

### Why This Stack

- supports bilingual SEO and clean route handling
- supports structured editorial publishing
- supports worker-driven ingestion and email pipelines
- keeps page delivery, API logic, and async jobs separate
- remains practical for a first implementation in a GitHub repo

## 10. SEO and Routing Rules

- English and Chinese pages must use independent routes and slugs
- each locale has its own title and meta description
- each localized detail page links to its counterpart
- route structure must stay clean and indexable
- public content pages should prefer static generation or cache-friendly rendering where possible

## 11. Operational Requirements

### Admin Review UX

The review screen should expose:

- raw lead evidence
- AI-extracted structured fields
- risk labels and confidence score
- editable English and Chinese content
- publish actions:
  - discard
  - save draft
  - publish now
  - schedule
  - mark featured

### Retention Workflow

v1 retention loop:

1. user logs in with email code
2. user favorites deals
3. user configures digest language/preferences
4. worker sends daily digest from new and relevant content

## 12. Non-Functional Requirements

- detail pages must communicate value quickly and clearly
- AI outputs must be auditable and editable
- source fetchers need source-level enable/disable control
- failed jobs need retry and manual rerun support
- digest sending must prioritize reliability over sophistication
- the codebase must remain cleanly structured for incremental extension

## 13. Delivery and Collaboration Constraints

These are execution constraints for implementation, not optional preferences:

- all content and code must live in a GitHub-publishable repository
- implementation should use parallel multi-agent work where tasks are independent
- every development round requires review before claiming completion
- all important code paths must be verified with runnable checks before merge/push
- only reviewed changes may be pushed
- the working tree must be clean before push
- once one batch of tasks is verified, work should continue automatically into the next batch until the site is successfully built

## 14. Implementation Order

1. initialize monorepo and shared tooling
2. define database schema and authentication
3. build the main pipeline from `Source -> Lead -> AI Review -> Admin Edit -> Publish`
4. build bilingual public routes and detail pages
5. build favorites and digest preferences
6. build daily digest workers
7. build operational curation features
8. add selected historical-price snapshots
9. verify end-to-end behavior
10. prepare repository for GitHub push

## 15. Success Criteria

The first release is successful if:

- an editor can take a raw lead and publish a bilingual deal within minutes
- users can log in, favorite deals, and receive daily email summaries
- detail pages make the conversion path obvious
- the homepage is operationally curated, not an unstructured feed
- the repository is understandable, runnable, reviewable, and safe to keep extending
