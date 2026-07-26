ALTER TABLE categories
  ADD COLUMN emoji VARCHAR(8) NOT NULL DEFAULT '📦' AFTER name;

UPDATE categories SET emoji = '🍔' WHERE name = 'Food';
UPDATE categories SET emoji = '✈️' WHERE name = 'Travel';
UPDATE categories SET emoji = '🛍️' WHERE name = 'Shopping';
UPDATE categories SET emoji = '🧾' WHERE name = 'Bills';
UPDATE categories SET emoji = '💊' WHERE name = 'Health';
UPDATE categories SET emoji = '🏠' WHERE name = 'Home';
UPDATE categories SET emoji = '🎬' WHERE name = 'Entertainment';
