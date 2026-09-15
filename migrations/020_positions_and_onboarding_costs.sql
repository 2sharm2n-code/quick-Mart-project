CREATE TABLE IF NOT EXISTS position_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text UNIQUE NOT NULL,
  monthly_pay_kes integer,
  slots_available integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Store Assistant', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Cashier', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Branch Supervisor', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Stock Controller', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Cleaner', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Security Guard', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Shelf Attendant', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Storekeeper', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Customer Service Assistant', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Driver', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Warehouse Assistant', NULL, 0, true) ON CONFLICT (title) DO NOTHING;
INSERT INTO position_catalog(title, monthly_pay_kes, slots_available, active) VALUES ('Security Supervisor', NULL, 0, true) ON CONFLICT (title) DO NOTHING;

UPDATE position_catalog SET slots_available = 5 WHERE slots_available = 0 AND active = true;
UPDATE cost_items SET price_kes = 1750, description = 'Optional relocation/accommodation deposit of KSh 3,500 total. QuickMart Kenya covers KSh 1,750; the applicant pays the other half.', is_required = false WHERE lower(name) IN ('accommodation assistance','relocation deposit');
UPDATE cost_items SET price_kes = 1000, description = 'Mandatory pre-employment health checkup required before onboarding.', is_required = true WHERE lower(name) IN ('pre-employment health checkup','health checkup');
UPDATE cost_items SET description = 'Optional QuickMart uniform package for onboarding.', is_required = false WHERE lower(name) = 'uniform package';