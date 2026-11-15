-- Turn monthly budgets into standing budgets, taking only the 2026-10 budgets.
-- Budgets saved for any other month are soft-deleted.
-- Within one scope, October has at most one active row (the old unique key included month),
-- so the new unique key on (household, category, scope) cannot conflict.
UPDATE budgets
SET deleted_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND month <> '2026-10';

-- Foreign keys on household_id and category_id need an index led by that column.
-- Add explicit ones before dropping the indexes that currently serve them.
ALTER TABLE budgets
  ADD INDEX budgets_household_fk_idx (household_id),
  ADD INDEX budgets_category_fk_idx (category_id);

ALTER TABLE budgets DROP INDEX budgets_scope_unique;
ALTER TABLE budgets DROP INDEX budgets_household_month_idx;
ALTER TABLE budgets DROP COLUMN month;
ALTER TABLE budgets ADD UNIQUE KEY budgets_scope_unique (household_id, category_id, budget_scope_id);
