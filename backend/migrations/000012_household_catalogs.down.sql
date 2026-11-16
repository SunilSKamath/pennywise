ALTER TABLE payment_sources DROP INDEX payment_sources_household_name_active_unique;
ALTER TABLE payment_sources DROP FOREIGN KEY payment_sources_household_fk;
ALTER TABLE payment_sources DROP INDEX payment_sources_household_idx;
ALTER TABLE payment_sources DROP COLUMN household_id;

ALTER TABLE categories DROP INDEX categories_household_name_active_unique;
ALTER TABLE categories DROP FOREIGN KEY categories_household_fk;
ALTER TABLE categories DROP INDEX categories_household_idx;
ALTER TABLE categories DROP COLUMN household_id;
ALTER TABLE categories
  ADD UNIQUE KEY categories_name_active_unique (name, deleted_at);
