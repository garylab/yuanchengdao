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
  location_requirement INTEGER DEFAULT 0,
  english_level_required TEXT NOT NULL DEFAULT 'none' CHECK (english_level_required IN (
    'none', 'basic', 'intermediate', 'upper_intermediate', 'B2', 'C1', 'C2', 'advanced', 'fluent', 'native'
  )),
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
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company_posted ON jobs(company_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_location_posted ON jobs(location_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_country_posted ON jobs(country_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_search_term_posted ON jobs(search_term_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_search_term_created_at ON jobs(search_term_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_posted ON jobs(salary_upper, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_job_count ON companies(job_count DESC);
CREATE INDEX IF NOT EXISTS idx_locations_job_count ON locations(job_count DESC);
CREATE INDEX IF NOT EXISTS idx_locations_active_job_count ON locations(is_active, job_count DESC);
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

-- Crawl plan: one persistent row per (search_term, country) pair
CREATE TABLE IF NOT EXISTS crawl_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_term_id INTEGER NOT NULL REFERENCES search_terms(id),
  country_code TEXT NOT NULL,
  hit_count INTEGER DEFAULT 0,
  miss_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,
  UNIQUE(search_term_id, country_code)
);

CREATE INDEX IF NOT EXISTS idx_crawl_plan_next ON crawl_plan(miss_count, processed_at);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  telegram_chat_id TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS email_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);
CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at ON email_otps(expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate_key TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_key_created ON auth_rate_limits(rate_key, created_at);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_job_id ON favorites(job_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  search_term_id INTEGER NOT NULL REFERENCES search_terms(id),
  location_id INTEGER REFERENCES locations(id),
  notify_email INTEGER NOT NULL DEFAULT 1,
  notify_telegram INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_term_location
  ON subscriptions(user_id, search_term_id, IFNULL(location_id, 0));
CREATE INDEX IF NOT EXISTS idx_subscriptions_search_term ON subscriptions(search_term_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS subscription_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  delivered_at TEXT DEFAULT (datetime('now')),
  email_delivered_at TEXT,
  telegram_delivered_at TEXT,
  UNIQUE(subscription_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_deliveries_subscription ON subscription_deliveries(subscription_id);

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_token ON telegram_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user_id ON telegram_link_tokens(user_id);
