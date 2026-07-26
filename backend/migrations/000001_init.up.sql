CREATE TABLE households (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  base_currency_code CHAR(3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  name VARCHAR(255) NOT NULL,
  picture_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY users_google_id_unique (google_id),
  UNIQUE KEY users_email_unique (email)
);

CREATE TABLE categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  UNIQUE KEY categories_name_active_unique (name, deleted_at)
);

CREATE TABLE payment_sources (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type ENUM('bank_account', 'credit_card', 'upi', 'cash', 'other') NOT NULL,
  currency_code CHAR(3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX payment_sources_deleted_at_idx (deleted_at)
);

CREATE TABLE expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  original_amount_minor BIGINT NOT NULL,
  original_currency_code CHAR(3) NOT NULL,
  converted_amount_minor BIGINT NOT NULL,
  converted_currency_code CHAR(3) NOT NULL,
  exchange_rate DECIMAL(24, 10) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  payment_source_id BIGINT UNSIGNED NOT NULL,
  merchant VARCHAR(255) NOT NULL DEFAULT '',
  notes TEXT NOT NULL,
  expense_date DATETIME NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT expenses_category_fk FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT expenses_payment_source_fk FOREIGN KEY (payment_source_id) REFERENCES payment_sources (id),
  CONSTRAINT expenses_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id),
  INDEX expenses_date_idx (expense_date),
  INDEX expenses_created_by_date_idx (created_by, expense_date),
  INDEX expenses_category_idx (category_id),
  INDEX expenses_payment_source_idx (payment_source_id),
  INDEX expenses_deleted_at_idx (deleted_at)
);

INSERT INTO households (id, name, base_currency_code)
VALUES (1, 'Kamath Family', 'INR');

INSERT INTO users (id, google_id, email, name, picture_url)
VALUES (1, 'dev-user', 'dev@example.local', 'Dev User', '');

INSERT INTO categories (name)
VALUES ('Food'), ('Travel'), ('Shopping'), ('Bills'), ('Health'), ('Home'), ('Entertainment');

INSERT INTO payment_sources (name, type, currency_code)
VALUES
  ('Cash', 'cash', 'INR'),
  ('Google Pay', 'upi', 'INR'),
  ('Savings Account', 'bank_account', 'INR');
