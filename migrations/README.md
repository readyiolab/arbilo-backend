# Backend migrations

Apply SQL files in numeric order against the Arbilo MySQL database.

1. Back up the database.
2. Run: `mysql -u USER -p DATABASE < migrations/001_indexes.sql`
   - Or paste/import the file in phpMyAdmin.
   - Index creation is **idempotent** (existing indexes are skipped; no `#1061 Duplicate key name`).
3. Restart the API (`npm start` uses `node index.js` in production).

Notes:
- App code expects `tbl_support_tickets` and `tbl_feedback` (not unprefixed names).
- Optional Redis: set `REDIS_HOST` / `REDIS_PORT` or `REDIS_URL` for multi-instance cache sharing. Without Redis the API falls back to in-memory cache (single instance only).
- Rotate JWT, DB, SMTP, and Spaces credentials if they were ever committed or shared.
