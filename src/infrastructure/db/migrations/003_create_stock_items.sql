CREATE TABLE IF NOT EXISTS stock_items (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  unit_of_measure TEXT,
  quantity INTEGER NOT NULL,
  price NUMERIC(15, 2) NOT NULL
);
