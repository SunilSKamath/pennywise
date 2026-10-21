ALTER TABLE budgets DROP INDEX budgets_scope_unique;

ALTER TABLE budgets DROP COLUMN budget_scope_id;

ALTER TABLE budgets DROP FOREIGN KEY budgets_subcategory_fk;

ALTER TABLE budgets DROP COLUMN subcategory_id;

ALTER TABLE budgets
  ADD UNIQUE KEY budgets_household_category_month_unique (household_id, category_id, month, deleted_at);
