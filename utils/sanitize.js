const SENSITIVE_FIELDS = [
  'password',
  'session_token',
  'reset_token',
  'google_id',
];

function stripSensitive(row) {
  if (!row || typeof row !== 'object') return row;
  const clean = { ...row };
  for (const field of SENSITIVE_FIELDS) {
    delete clean[field];
  }
  return clean;
}

function stripSensitiveList(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(stripSensitive);
}

const USER_SAFE_COLUMNS =
  'id, name, email, is_active, is_verified, is_free_user, subscription_type, subscription_status, subscription_start_date, subscription_end_date, trial_end_date, created_at, updated_at';

const ADMIN_SAFE_COLUMNS = 'id, name, email, created_at';

module.exports = {
  stripSensitive,
  stripSensitiveList,
  SENSITIVE_FIELDS,
  USER_SAFE_COLUMNS,
  ADMIN_SAFE_COLUMNS,
};
