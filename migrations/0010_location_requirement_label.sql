-- Store WHICH country/region a job is restricted to, not just that it is
-- restricted. `location_requirement` alone renders as "限本国", which does not
-- tell the reader which country.
ALTER TABLE jobs ADD COLUMN location_requirement_label TEXT;
ALTER TABLE job_submissions ADD COLUMN location_requirement_label TEXT;
