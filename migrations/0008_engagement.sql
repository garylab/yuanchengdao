-- ---------------------------------------------------------------------------
-- jobs: chinese-friendly flag + source
-- ---------------------------------------------------------------------------
ALTER TABLE jobs ADD COLUMN chinese_friendly INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN source TEXT NOT NULL DEFAULT 'crawl';
CREATE INDEX IF NOT EXISTS idx_jobs_chinese_friendly_posted ON jobs(chinese_friendly, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_english_level_posted ON jobs(english_level_required, posted_at DESC);

UPDATE jobs SET chinese_friendly = 1
WHERE chinese_friendly = 0 AND (
  title LIKE '%中文%' OR title LIKE '%普通话%' OR title LIKE '%华人%' OR title LIKE '%汉语%' OR title LIKE '%粤语%'
  OR title LIKE '%Mandarin%' OR title LIKE '%Cantonese%' OR title LIKE '%Chinese%'
  OR description LIKE '%中文%' OR description LIKE '%普通话%' OR description LIKE '%华人%' OR description LIKE '%汉语%' OR description LIKE '%粤语%'
  OR description LIKE '%Mandarin%' OR description LIKE '%Cantonese%' OR description LIKE '%Chinese speak%' OR description LIKE '%Chinese-speak%' OR description LIKE '%Chinese language%'
  OR job_highlights LIKE '%中文%' OR job_highlights LIKE '%普通话%' OR job_highlights LIKE '%Mandarin%' OR job_highlights LIKE '%Cantonese%'
);

-- ---------------------------------------------------------------------------
-- companies: profile enrichment
-- ---------------------------------------------------------------------------
ALTER TABLE companies ADD COLUMN description TEXT;
ALTER TABLE companies ADD COLUMN website TEXT;
ALTER TABLE companies ADD COLUMN enriched_at TEXT;

-- ---------------------------------------------------------------------------
-- users: weekly digest opt-in
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN weekly_digest INTEGER NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- feedback: track resolve notification
-- ---------------------------------------------------------------------------
ALTER TABLE feedback ADD COLUMN resolved_notified_at TEXT;

-- ---------------------------------------------------------------------------
-- favorites -> application tracker (status, notes, job snapshot that survives
-- job deletion at the 90-day mark)
-- ---------------------------------------------------------------------------
CREATE TABLE favorites_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'saved',
  notes TEXT,
  job_title TEXT,
  company_name TEXT,
  company_slug TEXT,
  job_slug TEXT,
  apply_url TEXT,
  job_posted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, job_id)
);

INSERT INTO favorites_new (id, user_id, job_id, status, job_title, company_name, company_slug, job_slug, apply_url, job_posted_at, created_at, updated_at)
SELECT f.id, f.user_id, f.job_id, 'saved',
  j.title, co.name, co.slug, j.slug,
  CASE WHEN j.apply_options IS NOT NULL THEN json_extract(j.apply_options, '$[0].link') ELSE NULL END,
  COALESCE(j.posted_at, j.created_at),
  f.created_at, f.created_at
FROM favorites f
LEFT JOIN jobs j ON j.id = f.job_id
LEFT JOIN companies co ON co.id = j.company_id;

DROP TABLE favorites;
ALTER TABLE favorites_new RENAME TO favorites;

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_job_id ON favorites(job_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_status ON favorites(user_id, status);

-- ---------------------------------------------------------------------------
-- subscriptions: support category / keyword / company kinds
-- (deliveries are backed up first because DROP TABLE cascades)
-- ---------------------------------------------------------------------------
CREATE TABLE subscription_deliveries_bak AS SELECT * FROM subscription_deliveries;

CREATE TABLE subscriptions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'category',
  search_term_id INTEGER REFERENCES search_terms(id),
  query_text TEXT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id),
  salary_range TEXT,
  notify_email INTEGER NOT NULL DEFAULT 1,
  notify_telegram INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO subscriptions_new (id, user_id, kind, search_term_id, location_id, salary_range, notify_email, notify_telegram, created_at)
SELECT id, user_id, 'category', search_term_id, location_id, salary_range, notify_email, notify_telegram, created_at
FROM subscriptions;

DROP TABLE subscriptions;
ALTER TABLE subscriptions_new RENAME TO subscriptions;

INSERT OR IGNORE INTO subscription_deliveries (id, subscription_id, job_id, delivered_at, email_delivered_at, telegram_delivered_at)
SELECT id, subscription_id, job_id, delivered_at, email_delivered_at, telegram_delivered_at FROM subscription_deliveries_bak;
DROP TABLE subscription_deliveries_bak;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_unique
  ON subscriptions(user_id, kind, IFNULL(search_term_id, 0), IFNULL(company_id, 0), IFNULL(query_text, ''), IFNULL(location_id, 0), IFNULL(salary_range, ''));
CREATE INDEX IF NOT EXISTS idx_subscriptions_search_term ON subscriptions(search_term_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_kind ON subscriptions(kind);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- ---------------------------------------------------------------------------
-- employer job submissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  company_website TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  apply_url TEXT,
  apply_email TEXT,
  location_text TEXT,
  location_requirement INTEGER NOT NULL DEFAULT 0,
  english_level TEXT NOT NULL DEFAULT 'none',
  schedule_type TEXT,
  salary_text TEXT,
  salary_lower INTEGER NOT NULL DEFAULT 0,
  salary_upper INTEGER NOT NULL DEFAULT 0,
  salary_pay_cycle TEXT NOT NULL DEFAULT 'month',
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_job_submissions_status_created ON job_submissions(status, created_at DESC);

-- ---------------------------------------------------------------------------
-- weekly report snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
