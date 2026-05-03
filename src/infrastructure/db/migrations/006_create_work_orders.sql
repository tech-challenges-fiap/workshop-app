CREATE TABLE IF NOT EXISTS work_orders (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  status TEXT NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  public_token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS work_orders_vehicle_id_idx ON work_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS work_orders_status_idx ON work_orders(status);
CREATE INDEX IF NOT EXISTS work_orders_public_token_idx ON work_orders(public_token);
