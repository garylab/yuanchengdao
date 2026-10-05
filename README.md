# 🌏 远程OK (yuancheng.co)

Remote job board for Chinese professionals. Jobs are fetched from Google Jobs via SerpAPI, translated to Chinese using ChatGPT, and served from Cloudflare Workers + D1.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the D1 database

```bash
npm run db:create
```

Copy the `database_id` from the output into `wrangler.toml`.

### 3. Run database migrations

```bash
# Local development
npm run db:migrate:local

# Production
npm run db:migrate
```

### 4. Set secrets

Create a `.dev.vars` file (see `.dev.vars.example`):

```
SERPAPI_KEY=your_key
OPENAI_API_KEY=your_key
```

For production:

```bash
wrangler secret put SERPAPI_KEY
wrangler secret put OPENAI_API_KEY
```

### 5. Run locally

```bash
npm run dev
```

### 6. Deploy

```bash
npm run deploy
```

## Architecture

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Framework**: Hono
- **Frontend**: Tailwind CSS (CDN)
- **Job Source**: SerpAPI (Google Jobs)
- **Translation**: OpenAI GPT-4o-mini
- **Cron**: Every 6 hours, auto-fetches and translates new remote jobs

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Homepage with job listings |
| `/job/:id` | GET | Job detail page |
| `/categories` | GET | Browse by category |
| `/about` | GET | About page |
| `/api/jobs` | GET | JSON API for jobs |
| `/api/categories` | GET | JSON API for categories |
| `/api/sync` | POST | Trigger manual job sync (requires auth) |
| `/sitemap.xml` | GET | SEO sitemap (index of 6 child sitemaps) |
| `/feed.xml` | GET | RSS 2.0 feed of the latest active jobs |
| `/jobs/chinese/feed.xml` | GET | RSS feed, Chinese-friendly jobs only |
| `/category/:slug/feed.xml` | GET | RSS feed for one job category |
| `/country/:slug/feed.xml` | GET | RSS feed for one country |
| `/og/job/:slug.png` | GET | 1200x630 social share card, rendered once and cached in R2 |

## SEO & distribution notes

- **Job lifecycle.** A posting is *active* for 30 days: inside that window it is in
  `sitemap-jobs.xml`, indexable, and its JobPosting `validThrough` is still in the
  future. Between 30 and 90 days it still resolves but is served `noindex` and
  dropped from the sitemap. After 90 days it returns 410. The three signals are
  meant to stay in step — change one and change the others.
- **`applicantLocationRequirements`** comes from `jobs.location_requirement` +
  `location_requirement_label`, mapped through `APPLICANT_AREA_BY_CN` in
  `services/locationRequirement.ts`. An unrestricted or unknown posting emits no
  property at all, which Google reads as "unspecified" — never guess a country.
- **Share cards** need `CF_ACCOUNT_ID` (var) and `CF_API_TOKEN` (secret, Browser
  Rendering permission). Without them `/og/*` redirects to the static logo, so the
  pages stay valid but the cards are plain.
- **Analytics.** Cloudflare Web Analytics is already running, injected at the
  edge by the zone's automatic setup — it reaches Workers-generated HTML fine, so
  there is deliberately no beacon in `layout()`. Adding one would count every
  view twice.
  - Do not try to confirm the beacon with a plain `curl`: injection is skipped
    for requests that look like bots, so a bare User-Agent returns HTML with no
    beacon and looks like proof it is broken. Send real browser headers
    (`Accept`, `Accept-Language`, `Sec-Fetch-*`, a full Chrome UA) to see it.
  - GA is still in `layout()` and still unreachable from mainland China, so Web
    Analytics is the only numbers the largest part of the audience shows up in.
  - Worth checking once in the dashboard: the configuration Cloudflare enables by
    default **drops EU visitors**. Given how much of this board is EMEA/EU work,
    that would quietly skew the traffic mix.
