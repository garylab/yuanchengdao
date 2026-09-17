ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- The first user (lowest id) is always the admin.
UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users);
