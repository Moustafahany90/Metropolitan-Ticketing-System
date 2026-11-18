BEGIN;
-- Update ticketing DB: make mabdelnasser an ADMIN with roleLabel "Admin"
UPDATE "User"
SET "role" = 'ADMIN', "roleLabel" = 'Admin'
WHERE "username" = 'mabdelnasser';
COMMIT;
