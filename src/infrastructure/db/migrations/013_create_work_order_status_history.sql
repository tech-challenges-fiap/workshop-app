CREATE TABLE IF NOT EXISTS work_order_status_history (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by_person_id INTEGER REFERENCES person(id),
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_work_order_status_history_work_order_id
  ON work_order_status_history(work_order_id);

CREATE INDEX IF NOT EXISTS idx_work_order_status_history_to_status_changed_at
  ON work_order_status_history(to_status, changed_at);
