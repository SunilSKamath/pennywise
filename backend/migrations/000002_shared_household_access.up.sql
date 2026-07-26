ALTER TABLE users
  ADD COLUMN household_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX users_household_idx (household_id),
  ADD CONSTRAINT users_household_fk FOREIGN KEY (household_id) REFERENCES households (id);

ALTER TABLE expenses
  ADD COLUMN household_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
  ADD INDEX expenses_household_date_idx (household_id, expense_date),
  ADD CONSTRAINT expenses_household_fk FOREIGN KEY (household_id) REFERENCES households (id);

UPDATE users SET household_id = 1 WHERE household_id = 0;
UPDATE expenses SET household_id = 1 WHERE household_id = 0;

