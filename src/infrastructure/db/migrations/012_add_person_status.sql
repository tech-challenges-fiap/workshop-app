ALTER TABLE person
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE person
ADD CONSTRAINT person_status_check
CHECK (status IN ('active', 'inactive', 'blocked'))
NOT VALID;

ALTER TABLE person
VALIDATE CONSTRAINT person_status_check;
