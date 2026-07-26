CREATE TABLE savings_goals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  emoji VARCHAR(16) NOT NULL DEFAULT '🎯',
  target_amount_minor BIGINT NOT NULL,
  current_amount_minor BIGINT NOT NULL DEFAULT 0,
  currency_code CHAR(3) NOT NULL,
  target_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT savings_goals_household_fk FOREIGN KEY (household_id) REFERENCES households (id),
  INDEX savings_goals_household_idx (household_id),
  INDEX savings_goals_deleted_at_idx (deleted_at)
);

CREATE TABLE budgets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  month CHAR(7) NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT budgets_household_fk FOREIGN KEY (household_id) REFERENCES households (id),
  CONSTRAINT budgets_category_fk FOREIGN KEY (category_id) REFERENCES categories (id),
  UNIQUE KEY budgets_household_category_month_unique (household_id, category_id, month, deleted_at),
  INDEX budgets_household_month_idx (household_id, month)
);
