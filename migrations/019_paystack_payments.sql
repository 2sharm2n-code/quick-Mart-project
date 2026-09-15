ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider text DEFAULT 'paystack';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS authorization_url text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS payments_payment_reference_key ON payments(payment_reference) WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_provider_status_idx ON payments(provider, status);
