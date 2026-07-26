CREATE TABLE user_households (
  user_id BIGINT UNSIGNED NOT NULL,
  household_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, household_id),
  CONSTRAINT user_households_user_fk FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT user_households_household_fk FOREIGN KEY (household_id) REFERENCES households (id)
);

INSERT IGNORE INTO user_households (user_id, household_id)
SELECT id, household_id
FROM users
WHERE household_id > 0;
