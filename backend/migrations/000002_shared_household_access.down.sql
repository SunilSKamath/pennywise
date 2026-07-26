ALTER TABLE expenses
  DROP FOREIGN KEY expenses_household_fk,
  DROP INDEX expenses_household_date_idx,
  DROP COLUMN household_id;

ALTER TABLE users
  DROP FOREIGN KEY users_household_fk,
  DROP INDEX users_household_idx,
  DROP COLUMN household_id;

