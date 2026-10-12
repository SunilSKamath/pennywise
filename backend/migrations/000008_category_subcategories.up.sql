CREATE TABLE category_subcategories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT category_subcategories_category_fk FOREIGN KEY (category_id) REFERENCES categories (id),
  INDEX category_subcategories_category_idx (category_id, deleted_at)
);

ALTER TABLE expenses
  ADD COLUMN subcategory_id BIGINT UNSIGNED NULL AFTER category_id,
  ADD CONSTRAINT expenses_subcategory_fk FOREIGN KEY (subcategory_id) REFERENCES category_subcategories (id),
  ADD INDEX expenses_subcategory_idx (subcategory_id);

INSERT INTO category_subcategories (category_id, name)
SELECT c.id, seed.name
FROM categories c
JOIN (
  SELECT 'Food' AS category_name, 'Order food' AS name
  UNION ALL SELECT 'Food', 'Dine out'
  UNION ALL SELECT 'Home', 'Groceries'
  UNION ALL SELECT 'Home', 'Utilities'
  UNION ALL SELECT 'Home', 'Repairs'
  UNION ALL SELECT 'Entertainment', 'Movies'
  UNION ALL SELECT 'Entertainment', 'Subscriptions'
  UNION ALL SELECT 'Entertainment', 'Outing'
) seed ON seed.category_name = c.name
WHERE c.deleted_at IS NULL;
