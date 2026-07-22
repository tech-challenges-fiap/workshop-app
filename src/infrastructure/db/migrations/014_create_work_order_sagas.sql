CREATE TABLE IF NOT EXISTS work_order_sagas (
  id SERIAL PRIMARY KEY,
  saga_id UUID NOT NULL UNIQUE,
  work_order_id INTEGER NOT NULL UNIQUE REFERENCES work_orders(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  last_event_id TEXT,
  compensation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_order_saga_events (
  id SERIAL PRIMARY KEY,
  saga_id UUID NOT NULL REFERENCES work_order_sagas(saga_id) ON DELETE CASCADE,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_order_saga_events_saga_id
  ON work_order_saga_events(saga_id);
