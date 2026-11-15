ALTER TABLE budgets DROP INDEX budgets_scope_unique;

ALTER TABLE budgets
  ADD COLUMN month CHAR(7) NULL AFTER subcategory_id;

UPDATE budgets SET month = '2026-10' WHERE month IS NULL;

ALTER TABLE budgets
  MODIFY month CHAR(7) NOT NULL,
  ADD UNIQUE KEY budgets_scope_unique (household_id, category_id, budget_scope_id, month),
  ADD INDEX budgets_household_month_idx (household_id, month);

ALTER TABLE budgets
  DROP INDEX budgets_household_fk_idx,
  DROP INDEX budgets_category_fk_idx;
