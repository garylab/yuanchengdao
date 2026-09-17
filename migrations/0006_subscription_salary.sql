ALTER TABLE subscriptions ADD COLUMN salary_range TEXT;

DROP INDEX IF EXISTS idx_subscriptions_user_term_location;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_term_location_salary
  ON subscriptions(user_id, search_term_id, IFNULL(location_id, 0), IFNULL(salary_range, ''));
