CREATE TABLE IF NOT EXISTS service_tasks (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id),
  work_order_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  estimated_time_minutes INTEGER NOT NULL,
  service_price NUMERIC(15, 2) NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_tasks_service_id_idx ON service_tasks(service_id);
CREATE INDEX IF NOT EXISTS service_tasks_status_idx ON service_tasks(status);
CREATE INDEX IF NOT EXISTS service_tasks_work_order_id_idx ON service_tasks(work_order_id);
