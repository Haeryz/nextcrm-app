-- Extensions used by NextCRM and commonly available in Supabase Postgres.
-- This script is idempotent and runs only when the database volume is created.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
