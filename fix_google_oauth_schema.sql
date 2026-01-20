-- Fix Google OAuth Schema Issues for Arbilo
-- Run these commands on your database (db_arbilo) to enable Google login
-- Connect to: 139.59.8.68 as admin
-- NOTE: Run each command SEPARATELY. If you get "Duplicate column" error, skip that command.

-- Check current table structure first
DESCRIBE tbl_users;

-- 1. Add google_id column (run this first)
-- If you get "Duplicate column name 'google_id'" error, the column already exists - skip this
ALTER TABLE tbl_users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL;

-- 2. Modify password column to allow NULL values (for Google OAuth users who don't have passwords)
ALTER TABLE tbl_users MODIFY COLUMN password VARCHAR(255) NULL;

-- 3. Add is_free_user column
-- If you get "Duplicate column name 'is_free_user'" error, the column already exists - skip this
ALTER TABLE tbl_users ADD COLUMN is_free_user INT DEFAULT 1;

-- 4. Create index on google_id for faster lookups (optional)
-- If you get "Duplicate key name" error, the index already exists - skip this
CREATE INDEX idx_google_id ON tbl_users(google_id);

-- Verify the changes
DESCRIBE tbl_users;

-- Check if there are any users already
SELECT id, name, email, google_id, is_free_user, is_active FROM tbl_users LIMIT 10;
