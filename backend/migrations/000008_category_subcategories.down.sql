ALTER TABLE expenses DROP FOREIGN KEY expenses_subcategory_fk;
ALTER TABLE expenses DROP INDEX expenses_subcategory_idx;
ALTER TABLE expenses DROP COLUMN subcategory_id;
DROP TABLE IF EXISTS category_subcategories;
