ALTER TABLE categories
  ADD COLUMN household_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX categories_household_idx (household_id),
  ADD CONSTRAINT categories_household_fk FOREIGN KEY (household_id) REFERENCES households (id);

UPDATE categories SET household_id = 1 WHERE household_id = 0;

ALTER TABLE categories DROP INDEX categories_name_active_unique;
ALTER TABLE categories
  ADD UNIQUE KEY categories_household_name_active_unique (household_id, name, deleted_at);

ALTER TABLE categories ALTER COLUMN household_id DROP DEFAULT;

ALTER TABLE payment_sources
  ADD COLUMN household_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX payment_sources_household_idx (household_id),
  ADD CONSTRAINT payment_sources_household_fk FOREIGN KEY (household_id) REFERENCES households (id);

UPDATE payment_sources SET household_id = 1 WHERE household_id = 0;

ALTER TABLE payment_sources
  ADD UNIQUE KEY payment_sources_household_name_active_unique (household_id, name, deleted_at);

ALTER TABLE payment_sources ALTER COLUMN household_id DROP DEFAULT;
