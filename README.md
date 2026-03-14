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
| `/sitemap.xml` | GET | SEO sitemap |
