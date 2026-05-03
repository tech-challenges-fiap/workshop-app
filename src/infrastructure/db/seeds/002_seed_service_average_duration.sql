-- Seed to simulate one service used in 3 finalized work orders
-- This seed creates 3 work orders for the existing 'Oil Change' service
-- and one COMPLETED service task for each, with different execution durations.

-- Ensure there is a vehicle and service to use (relies on 001_seed_base.sql)

-- Work order 1: FINALIZED with one completed Oil Change task (~60 minutes)
INSERT INTO work_orders (vehicle_id, status, total_amount, public_token, public_token_expires_at)
SELECT v.id, 'FINALIZED', s.price, 'average-wo-001', now() + interval '7 days'
FROM vehicles v
JOIN services s ON s.name = 'Oil Change'
WHERE v.plate = 'ABC1D23'
ON CONFLICT (public_token) DO UPDATE SET
  vehicle_id = EXCLUDED.vehicle_id,
  status = EXCLUDED.status,
  total_amount = EXCLUDED.total_amount,
  public_token_expires_at = EXCLUDED.public_token_expires_at;

INSERT INTO service_tasks (
  service_id,
  work_order_id,
  status,
  estimated_time_minutes,
  service_price,
  started_at,
  completed_at
)
SELECT s.id, wo.id, 'COMPLETED', s.estimated_time_minutes, s.price,
       '2024-01-10T09:00:00.000Z', '2024-01-10T10:00:00.000Z'
FROM services s
JOIN work_orders wo ON wo.public_token = 'average-wo-001'
WHERE s.name = 'Oil Change'
  AND NOT EXISTS (
    SELECT 1
    FROM service_tasks st
    WHERE st.service_id = s.id AND st.work_order_id = wo.id
  );

-- Work order 2: FINALIZED with one completed Oil Change task (~120 minutes)
INSERT INTO work_orders (vehicle_id, status, total_amount, public_token, public_token_expires_at)
SELECT v.id, 'FINALIZED', s.price, 'average-wo-002', now() + interval '7 days'
FROM vehicles v
JOIN services s ON s.name = 'Oil Change'
WHERE v.plate = 'ABC1D23'
ON CONFLICT (public_token) DO UPDATE SET
  vehicle_id = EXCLUDED.vehicle_id,
  status = EXCLUDED.status,
  total_amount = EXCLUDED.total_amount,
  public_token_expires_at = EXCLUDED.public_token_expires_at;

INSERT INTO service_tasks (
  service_id,
  work_order_id,
  status,
  estimated_time_minutes,
  service_price,
  started_at,
  completed_at
)
SELECT s.id, wo.id, 'COMPLETED', s.estimated_time_minutes, s.price,
       '2024-01-10T09:00:00.000Z', '2024-01-10T11:00:00.000Z'
FROM services s
JOIN work_orders wo ON wo.public_token = 'average-wo-002'
WHERE s.name = 'Oil Change'
  AND NOT EXISTS (
    SELECT 1
    FROM service_tasks st
    WHERE st.service_id = s.id AND st.work_order_id = wo.id
  );

-- Work order 3: FINALIZED with one completed Oil Change task (~30 minutes)
INSERT INTO work_orders (vehicle_id, status, total_amount, public_token, public_token_expires_at)
SELECT v.id, 'FINALIZED', s.price, 'average-wo-003', now() + interval '7 days'
FROM vehicles v
JOIN services s ON s.name = 'Oil Change'
WHERE v.plate = 'ABC1D23'
ON CONFLICT (public_token) DO UPDATE SET
  vehicle_id = EXCLUDED.vehicle_id,
  status = EXCLUDED.status,
  total_amount = EXCLUDED.total_amount,
  public_token_expires_at = EXCLUDED.public_token_expires_at;

INSERT INTO service_tasks (
  service_id,
  work_order_id,
  status,
  estimated_time_minutes,
  service_price,
  started_at,
  completed_at
)
SELECT s.id, wo.id, 'COMPLETED', s.estimated_time_minutes, s.price,
       '2024-01-10T09:00:00.000Z', '2024-01-10T09:30:00.000Z'
FROM services s
JOIN work_orders wo ON wo.public_token = 'average-wo-003'
WHERE s.name = 'Oil Change'
  AND NOT EXISTS (
    SELECT 1
    FROM service_tasks st
    WHERE st.service_id = s.id AND st.work_order_id = wo.id
  );
