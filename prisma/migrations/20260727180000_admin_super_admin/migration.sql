-- Ensure admin@mektek.com is a SUPER ADMIN (is_admin = true).
-- This addresses the post-deploy Unauthorized bug where the admin account
-- may have lost its owner flag after the DB was wiped and re-created.
UPDATE "Users"
SET "is_admin" = true,
    "is_account_admin" = true,
    "userStatus" = 'ACTIVE'
WHERE "email" = 'admin@mektek.com';

-- If the admin account does not exist yet, create it with a placeholder
-- password that must be reset via the forgot-password flow on first use.
INSERT INTO "Users" (
  "id", "email", "name", "username", "password",
  "is_admin", "is_account_admin", "userStatus", "userLanguage",
  "authVersion", "created_on"
)
SELECT
  gen_random_uuid(),
  'admin@mektek.com',
  'Super Admin',
  'Super Admin',
  '',
  true,
  true,
  'ACTIVE',
  'id',
  0,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "Users" WHERE "email" = 'admin@mektek.com'
);
