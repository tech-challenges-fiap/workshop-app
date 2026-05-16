CREATE TABLE IF NOT EXISTS service_task_parts (
  id SERIAL PRIMARY KEY,
  service_task_id INTEGER NOT NULL REFERENCES service_tasks(id) ON DELETE CASCADE,
  stock_item_id INTEGER NOT NULL REFERENCES stock_items(id),
  quantity INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS service_task_parts_service_task_id_idx ON service_task_parts(service_task_id);
CREATE INDEX IF NOT EXISTS service_task_parts_stock_item_id_idx ON service_task_parts(stock_item_id);
