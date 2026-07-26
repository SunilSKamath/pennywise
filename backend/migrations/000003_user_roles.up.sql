ALTER TABLE users
  ADD COLUMN role ENUM('admin', 'user') NOT NULL DEFAULT 'user' AFTER picture_url,
  ADD COLUMN status ENUM('pending', 'active') NOT NULL DEFAULT 'pending' AFTER role,
  ADD INDEX users_role_status_idx (role, status);

UPDATE users
SET role = 'user', status = 'active';

UPDATE users
SET role = 'admin'
WHERE id = 1;
