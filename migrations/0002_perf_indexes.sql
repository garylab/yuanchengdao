CREATE INDEX IF NOT EXISTS idx_jobs_search_term_created_at ON jobs(search_term_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_active_job_count ON locations(is_active, job_count DESC);
