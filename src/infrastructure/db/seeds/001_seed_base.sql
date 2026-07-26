INSERT INTO person (name, document, phone, email, role, status)
VALUES
  ('John Doe', '52998224725', '+5511999990000', 'john.doe@example.com', 'customer', 'active'),
  ('Mary Front', '16899535009', '+5511988887777', 'mary.front@example.com', 'front-desk', 'active'),
  ('Carl Mechanic', '35795145637', '+5511977776666', 'carl.mechanic@example.com', 'mecanic', 'active'),
  ('Ana Bloqueada', '98765432100', '+5511966665555', 'ana.bloqueada@example.com', 'customer', 'inactive')
ON CONFLICT (document) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

INSERT INTO vehicles (plate, brand, model, year, owner_person_id)
SELECT 'ABC1D23', 'Fiat', 'Uno', 2015, p.id
FROM person p
WHERE p.document = '52998224725'
ON CONFLICT (plate) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  owner_person_id = EXCLUDED.owner_person_id;

INSERT INTO stock_items (sku, name, description, unit_of_measure, quantity, price)
VALUES
  ('OIL-5W30', 'Motor Oil 5W30', 'Synthetic oil 1L', 'L', 50, 35.90),
  ('FILTER-OIL', 'Oil Filter', 'Standard oil filter', 'pc', 30, 18.50),
  ('BRAKE-PADS', 'Brake Pads', 'Front brake pad set', 'set', 20, 120.00)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit_of_measure = EXCLUDED.unit_of_measure,
  quantity = EXCLUDED.quantity,
  price = EXCLUDED.price;

INSERT INTO services (name, estimated_time_minutes, price)
SELECT 'Oil Change', 60, 150.00
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'Oil Change'
);

INSERT INTO services (name, estimated_time_minutes, price)
SELECT 'Brake Pad Replacement', 120, 300.00
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'Brake Pad Replacement'
);

INSERT INTO service_stock_items (service_id, stock_item_id, quantity)
SELECT s.id, si.id, 4
FROM services s
JOIN stock_items si ON si.sku = 'OIL-5W30'
WHERE s.name = 'Oil Change'
  AND NOT EXISTS (
    SELECT 1
    FROM service_stock_items ssi
    WHERE ssi.service_id = s.id AND ssi.stock_item_id = si.id
  );

INSERT INTO service_stock_items (service_id, stock_item_id, quantity)
SELECT s.id, si.id, 1
FROM services s
JOIN stock_items si ON si.sku = 'FILTER-OIL'
WHERE s.name = 'Oil Change'
  AND NOT EXISTS (
    SELECT 1
    FROM service_stock_items ssi
    WHERE ssi.service_id = s.id AND ssi.stock_item_id = si.id
  );

INSERT INTO service_stock_items (service_id, stock_item_id, quantity)
SELECT s.id, si.id, 1
FROM services s
JOIN stock_items si ON si.sku = 'BRAKE-PADS'
WHERE s.name = 'Brake Pad Replacement'
  AND NOT EXISTS (
    SELECT 1
    FROM service_stock_items ssi
    WHERE ssi.service_id = s.id AND ssi.stock_item_id = si.id
  );

INSERT INTO work_orders (vehicle_id, status, total_amount, public_token, public_token_expires_at)
SELECT v.id, 'RECEIVED', 450.00, 'public-token-001', now() + interval '7 days'
FROM vehicles v
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
  service_price
)
SELECT s.id, wo.id, 'PENDING_APPROVAL', s.estimated_time_minutes, s.price
FROM services s
JOIN work_orders wo ON wo.public_token = 'public-token-001'
WHERE s.name = 'Oil Change'
  AND NOT EXISTS (
    SELECT 1
    FROM service_tasks st
    WHERE st.service_id = s.id AND st.work_order_id = wo.id
  );

INSERT INTO service_tasks (
  service_id,
  work_order_id,
  status,
  estimated_time_minutes,
  service_price
)
SELECT s.id, wo.id, 'APPROVED', s.estimated_time_minutes, s.price
FROM services s
JOIN work_orders wo ON wo.public_token = 'public-token-001'
WHERE s.name = 'Brake Pad Replacement'
  AND NOT EXISTS (
    SELECT 1
    FROM service_tasks st
    WHERE st.service_id = s.id AND st.work_order_id = wo.id
  );
