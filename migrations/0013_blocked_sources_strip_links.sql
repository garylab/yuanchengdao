-- Blocking changed from "any apply link hits a rule" to "no first-party apply
-- link survives". Half of what the first week blocked still carried a company
-- careers page, an ATS link or a major board next to the aggregator copy.
--
-- Rules now also strip single links from listings that go on to publish, so
-- give them a counter for that, and reset the block counters so the numbers
-- reflect the new semantics once the blocked backlog is re-screened.
ALTER TABLE blocked_sources ADD COLUMN stripped_count INTEGER NOT NULL DEFAULT 0;

-- Hosts that slipped through as "clean" links on otherwise blocked listings.
INSERT OR IGNORE INTO blocked_sources (pattern, match_type, note, is_active) VALUES
  ('is-great.org', 'domain', '免费子域（hirevault 采集站所在主机）', 1),
  ('talk4fun.net', 'domain', '免费子域（jobwave 采集站所在主机）', 1);

UPDATE blocked_sources SET blocked_count = 0, last_blocked_at = NULL;

-- Re-screen everything blocked under the old rule. Listings with a surviving
-- first-party link publish; pure copies are blocked again without an OpenAI
-- call, since the screen runs before translation.
UPDATE jobs_crawled SET process_status = 0, failed_reason = NULL WHERE process_status = 45;
