CREATE TABLE tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  normalized_name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT tags_household_fk FOREIGN KEY (household_id) REFERENCES households (id),
  UNIQUE KEY tags_household_normalized_unique (household_id, normalized_name),
  INDEX tags_household_name_idx (household_id, name)
);

CREATE TABLE expense_tags (
  expense_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (expense_id, tag_id),
  CONSTRAINT expense_tags_expense_fk FOREIGN KEY (expense_id) REFERENCES expenses (id),
  CONSTRAINT expense_tags_tag_fk FOREIGN KEY (tag_id) REFERENCES tags (id),
  INDEX expense_tags_tag_idx (tag_id)
);
