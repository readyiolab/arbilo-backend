-- Arbilo production indexes & schema alignment
-- Apply: mysql -u USER -p DATABASE < migrations/001_indexes.sql
-- Idempotent: skips indexes that already exist (no #1061 errors).

DELIMITER //

DROP PROCEDURE IF EXISTS arbilo_ensure_index //

CREATE PROCEDURE arbilo_ensure_index(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_columns VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND index_name = p_index
  ) THEN
    SET @ddl = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '` (', p_columns, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

DELIMITER ;

CALL arbilo_ensure_index('tbl_users', 'idx_users_email', 'email');
CALL arbilo_ensure_index('tbl_users', 'idx_users_is_free', 'is_free_user');
CALL arbilo_ensure_index('tbl_users', 'idx_users_subscription_status', 'subscription_status');
CALL arbilo_ensure_index('tbl_users', 'idx_users_trial_end', 'trial_end_date');

CALL arbilo_ensure_index('tbl_admins', 'idx_admins_email', 'email');

CALL arbilo_ensure_index('tbl_login_activity', 'idx_login_activity_user_id', 'user_id');
CALL arbilo_ensure_index('tbl_login_activity', 'idx_login_activity_login_date', 'login_date');
CALL arbilo_ensure_index('tbl_login_activity', 'idx_login_activity_user_date', 'user_id, login_date');

CALL arbilo_ensure_index('tbl_blogs', 'idx_blogs_status', 'status');
CALL arbilo_ensure_index('tbl_blogs', 'idx_blogs_published_at', 'published_at');
CALL arbilo_ensure_index('tbl_comments', 'idx_comments_blog_id', 'blog_id');

CALL arbilo_ensure_index('tbl_newsletter_subscribers', 'idx_newsletter_email', 'email');
CALL arbilo_ensure_index('tbl_newsletter_subscribers', 'idx_newsletter_subscription_token', 'subscription_token');
CALL arbilo_ensure_index('tbl_newsletter_subscribers', 'idx_newsletter_unsubscribe_token', 'unsubscribe_token');
CALL arbilo_ensure_index('tbl_newsletter_subscribers', 'idx_newsletter_is_active', 'is_active');

DROP PROCEDURE IF EXISTS arbilo_ensure_index;

CREATE TABLE IF NOT EXISTS tbl_support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  subject VARCHAR(255),
  message TEXT,
  status VARCHAR(50) DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_support_created (created_at),
  INDEX idx_support_status (status)
);

CREATE TABLE IF NOT EXISTS tbl_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  rating INT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_created (created_at)
);
