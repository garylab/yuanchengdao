-- Source blocklist: listings that reach us through a scraper/aggregator site
-- are rejected before translation rather than republished as our own.
CREATE TABLE IF NOT EXISTS blocked_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'via' CHECK (match_type IN ('via', 'domain')),
  note TEXT,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  last_blocked_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_sources_pattern ON blocked_sources(match_type, pattern);
CREATE INDEX IF NOT EXISTS idx_blocked_sources_active ON blocked_sources(is_active);

-- Seed: sites whose whole business is republishing other boards' listings.
-- Enabled by default — a job reaching us through one of these is not a lead,
-- it is our own product bounced back at us.
INSERT OR IGNORE INTO blocked_sources (pattern, match_type, note, is_active) VALUES
  ('lensa',            'via',    '纯搬运站，大量重复改写岗位', 1),
  ('jooble',           'via',    '聚合采集站', 1),
  ('adzuna',           'via',    '聚合采集站', 1),
  ('talent.com',       'via',    '聚合采集站（原 neuvoo）', 1),
  ('neuvoo',           'via',    '聚合采集站（现 talent.com）', 1),
  ('jobrapido',        'via',    '聚合采集站', 1),
  ('jobsora',          'via',    '聚合采集站', 1),
  ('jobatus',          'via',    '聚合采集站', 1),
  ('jobisjob',         'via',    '聚合采集站', 1),
  ('jobijoba',         'via',    '聚合采集站', 1),
  ('jobtome',          'via',    '聚合采集站', 1),
  ('jobted',           'via',    '聚合采集站', 1),
  ('jobleads',         'via',    '聚合采集站', 1),
  ('whatjobs',         'via',    '聚合采集站', 1),
  ('careerjet',        'via',    '聚合采集站', 1),
  ('trovit',           'via',    '聚合采集站', 1),
  ('mitula',           'via',    '聚合采集站', 1),
  ('learn4good',       'via',    '聚合采集站', 1),
  ('laimoon',          'via',    '聚合采集站', 1),
  ('talentify',        'via',    '聚合采集站', 1),
  ('jobkralle',        'via',    '聚合采集站（德语）', 1),
  ('lensa.com',        'domain', '纯搬运站', 1),
  ('jooble.org',       'domain', '聚合采集站', 1),
  ('adzuna.com',       'domain', '聚合采集站', 1),
  ('talent.com',       'domain', '聚合采集站', 1),
  ('neuvoo.com',       'domain', '聚合采集站', 1),
  ('jobrapido.com',    'domain', '聚合采集站', 1),
  ('jobsora.com',      'domain', '聚合采集站', 1),
  ('jobatus.com',      'domain', '聚合采集站', 1),
  ('jobisjob.com',     'domain', '聚合采集站', 1),
  ('jobijoba.com',     'domain', '聚合采集站', 1),
  ('jobtome.com',      'domain', '聚合采集站', 1),
  ('jobted.com',       'domain', '聚合采集站', 1),
  ('jobleads.com',     'domain', '聚合采集站', 1),
  ('whatjobs.com',     'domain', '聚合采集站', 1),
  ('careerjet.com',    'domain', '聚合采集站', 1),
  ('trovit.com',       'domain', '聚合采集站', 1),
  ('mitula.com',       'domain', '聚合采集站', 1),
  ('learn4good.com',   'domain', '聚合采集站', 1),
  ('laimoon.com',      'domain', '聚合采集站', 1);

-- Seed: remote boards that are partly first-party (companies post directly) and
-- partly scraped. Loaded disabled so they are visible in the admin list as
-- candidates rather than silently dropping legitimate postings.
INSERT OR IGNORE INTO blocked_sources (pattern, match_type, note, is_active) VALUES
  ('remoteok',             'via',    '同类远程站，部分一手投放，默认不拦', 0),
  ('weworkremotely',       'via',    '同类远程站，部分一手投放，默认不拦', 0),
  ('remotive',             'via',    '同类远程站，默认不拦', 0),
  ('himalayas',            'via',    '同类远程站，默认不拦', 0),
  ('jobgether',            'via',    '同类远程站，采集成分高', 0),
  ('remoterocketship',     'via',    '同类远程站，采集成分高', 0),
  ('nodesk',               'via',    '同类远程站，默认不拦', 0),
  ('dailyremote',          'via',    '同类远程站，默认不拦', 0),
  ('workingnomads',        'via',    '同类远程站，默认不拦', 0),
  ('justremote',           'via',    '同类远程站，默认不拦', 0),
  ('europeremotely',       'via',    '同类远程站，默认不拦', 0),
  ('flexjobs',             'via',    '付费墙聚合站，默认不拦', 0),
  ('remoteok.com',         'domain', '同类远程站，默认不拦', 0),
  ('weworkremotely.com',   'domain', '同类远程站，默认不拦', 0),
  ('remotive.com',         'domain', '同类远程站，默认不拦', 0),
  ('himalayas.app',        'domain', '同类远程站，默认不拦', 0),
  ('jobgether.com',        'domain', '同类远程站，采集成分高', 0),
  ('remoterocketship.com', 'domain', '同类远程站，采集成分高', 0),
  ('nodesk.co',            'domain', '同类远程站，默认不拦', 0),
  ('dailyremote.com',      'domain', '同类远程站，默认不拦', 0),
  ('workingnomads.com',    'domain', '同类远程站，默认不拦', 0),
  ('justremote.co',        'domain', '同类远程站，默认不拦', 0),
  ('europeremotely.com',   'domain', '同类远程站，默认不拦', 0),
  ('flexjobs.com',         'domain', '付费墙聚合站，默认不拦', 0);
