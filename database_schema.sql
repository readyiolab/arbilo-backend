-- Database Schema Updates for Free User Tracking and Session Duration Tracking

-- 1. Update tbl_users table to add free user tracking
-- ALTER TABLE tbl_users ADD COLUMN is_free_user INT DEFAULT 1;

-- 2. Update tbl_login_activity table to track session duration
-- ALTER TABLE tbl_login_activity ADD COLUMN login_time DATETIME;
-- ALTER TABLE tbl_login_activity ADD COLUMN logout_time DATETIME;
-- ALTER TABLE tbl_login_activity ADD COLUMN login_date DATE;

-- Run these SQL commands to update your database schema:

-- If tbl_users doesn't have is_free_user column:
ALTER TABLE tbl_users ADD COLUMN is_free_user INT DEFAULT 1;

-- If tbl_login_activity doesn't have time tracking columns:
ALTER TABLE tbl_login_activity ADD COLUMN login_time DATETIME;
ALTER TABLE tbl_login_activity ADD COLUMN logout_time DATETIME;
ALTER TABLE tbl_login_activity ADD COLUMN login_date DATE;

-- Create index for better performance on login tracking queries
CREATE INDEX idx_login_activity_user_date ON tbl_login_activity(user_id, login_date);

-- Optional: View to get user session statistics
CREATE VIEW user_session_statistics AS
SELECT 
  user_id,
  login_date,
  COUNT(*) as total_sessions,
  AVG(TIME_TO_SEC(TIMEDIFF(logout_time, login_time))/60) as avg_session_minutes,
  MIN(login_time) as first_login,
  MAX(logout_time) as last_logout
FROM tbl_login_activity
WHERE login_time IS NOT NULL
GROUP BY user_id, login_date;

-- Query to check free user count
-- SELECT COUNT(*) as free_user_count FROM tbl_users WHERE is_free_user = 1;

-- Query to get user session history with duration
-- SELECT 
--   user_id,
--   login_time,
--   logout_time,
--   ROUND(TIME_TO_SEC(TIMEDIFF(logout_time, login_time))/60, 2) as session_minutes,
--   ip_address
-- FROM tbl_login_activity
-- WHERE user_id = ? AND logout_time IS NOT NULL
-- ORDER BY login_time DESC;
