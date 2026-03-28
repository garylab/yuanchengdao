-- Raw crawled data from SerpAPI, stored as-is
CREATE TABLE IF NOT EXISTS jobs_crawled (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  htidocid TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  location TEXT,
  via TEXT,
  description TEXT,
  thumbnail TEXT,
  extensions TEXT,
  detected_extensions TEXT,
  job_highlights TEXT,
  apply_options TEXT,
  search_country TEXT,
  search_term_id INTEGER REFERENCES search_terms(id),
  process_status INTEGER DEFAULT 0,
  failed_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Countries
CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_cn TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  flag_emoji TEXT DEFAULT '🌍',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  job_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Locations (city/region level, linked to a country)
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_cn TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  country_id INTEGER REFERENCES countries(id),
  job_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  thumbnail TEXT,
  location_id INTEGER REFERENCES locations(id),
  job_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Processed/translated jobs
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crawled_id INTEGER NOT NULL REFERENCES jobs_crawled(id),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  location_id INTEGER REFERENCES locations(id),
  country_id INTEGER REFERENCES countries(id),
  search_term_id INTEGER REFERENCES search_terms(id),
  posted_at TEXT,
  salary_lower INTEGER DEFAULT 0,
  salary_upper INTEGER DEFAULT 0,
  salary_currency TEXT DEFAULT 'CNY',
  salary_pay_cycle TEXT DEFAULT 'year',
  detected_extensions TEXT,
  job_highlights TEXT,
  apply_options TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crawled_htidocid ON jobs_crawled(htidocid);
CREATE INDEX IF NOT EXISTS idx_crawled_status ON jobs_crawled(process_status);
CREATE INDEX IF NOT EXISTS idx_countries_code ON countries(code);
CREATE INDEX IF NOT EXISTS idx_countries_slug ON countries(slug);
CREATE INDEX IF NOT EXISTS idx_countries_active ON countries(is_active);
CREATE INDEX IF NOT EXISTS idx_locations_slug ON locations(slug);
CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country_id);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_crawled_id ON jobs(crawled_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_slug ON jobs(slug);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company_posted ON jobs(company_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_location_posted ON jobs(location_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_country_posted ON jobs(country_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_search_term_posted ON jobs(search_term_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_posted ON jobs(salary_upper, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_job_count ON companies(job_count DESC);
CREATE INDEX IF NOT EXISTS idx_locations_job_count ON locations(job_count DESC);
CREATE INDEX IF NOT EXISTS idx_countries_job_count ON countries(job_count DESC);

-- Search terms for job crawling
CREATE TABLE IF NOT EXISTS search_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL UNIQUE,
  term_cn TEXT,
  slug TEXT UNIQUE,
  job_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_search_terms_active ON search_terms(is_active);
CREATE INDEX IF NOT EXISTS idx_search_terms_slug ON search_terms(slug);

-- Crawl plan: each row is one (search_term, country) query to execute
CREATE TABLE IF NOT EXISTS crawl_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_term_id INTEGER NOT NULL REFERENCES search_terms(id),
  country_code TEXT NOT NULL,
  status INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_crawl_plan_status ON crawl_plan(status);

-- Full-text search on job titles (pre-tokenized with jieba)
CREATE VIRTUAL TABLE IF NOT EXISTS jobs_fts USING fts5(title, posted_at UNINDEXED);

-- No seed data; countries are auto-created by the LLM during job processing
