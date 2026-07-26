ALTER TABLE users
  DROP INDEX users_role_status_idx,
  DROP COLUMN status,
  DROP COLUMN role;
