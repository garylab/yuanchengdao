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
  search_query TEXT,
  search_country TEXT,
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
  timezone TEXT NOT NULL DEFAULT 'UTC',
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
  is_active INTEGER DEFAULT 1,
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
CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_crawled_id ON jobs(crawled_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location_id);
CREATE INDEX IF NOT EXISTS idx_jobs_country ON jobs(country_id);
CREATE INDEX IF NOT EXISTS idx_jobs_slug ON jobs(slug);
CREATE INDEX IF NOT EXISTS idx_jobs_search_term ON jobs(search_term_id);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

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

-- No seed data; countries are auto-created by the LLM during job processing
