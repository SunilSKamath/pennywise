ALTER TABLE budgets
  ADD COLUMN subcategory_id BIGINT UNSIGNED NULL AFTER category_id,
  ADD CONSTRAINT budgets_subcategory_fk FOREIGN KEY (subcategory_id) REFERENCES category_subcategories (id);

ALTER TABLE budgets DROP INDEX budgets_household_category_month_unique;

ALTER TABLE budgets
  ADD COLUMN budget_scope_id BIGINT UNSIGNED
    AS (CASE WHEN deleted_at IS NULL THEN IFNULL(subcategory_id, 0) ELSE NULL END) STORED,
  ADD UNIQUE KEY budgets_scope_unique (household_id, category_id, budget_scope_id, month);
