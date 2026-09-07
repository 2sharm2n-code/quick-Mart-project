CREATE TABLE google_gmail_oauth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL UNIQUE,
  email text,
  refresh_token_ciphertext text,
  access_token_ciphertext text,
  access_token_expires_at timestamptz,
  oauth_state_hash text,
  oauth_state_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)