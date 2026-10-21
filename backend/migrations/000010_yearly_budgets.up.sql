ALTER TABLE categories
  ADD COLUMN yearly_budget_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER emoji;

CREATE TABLE yearly_budgets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  year CHAR(4) NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  active_year CHAR(4) AS (CASE WHEN deleted_at IS NULL THEN year ELSE NULL END) STORED,
  CONSTRAINT yearly_budgets_household_fk FOREIGN KEY (household_id) REFERENCES households (id),
  CONSTRAINT yearly_budgets_category_fk FOREIGN KEY (category_id) REFERENCES categories (id),
  UNIQUE KEY yearly_budgets_scope_unique (household_id, category_id, active_year),
  INDEX yearly_budgets_household_year_idx (household_id, year)
);
