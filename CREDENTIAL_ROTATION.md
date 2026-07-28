# Credential rotation checklist

Treat any secrets that lived in a shared `.env` or repo workspace as compromised.

Rotate:
- [ ] MySQL password (`DB_PASS`)
- [ ] `JWT_SECRET`, `JWT_LOGIN_SECRET`, `JWT_SIGNUP_SECRET` (users must re-login)
- [ ] Google OAuth client secret
- [ ] SMTP password
- [ ] DigitalOcean Spaces keys
- [ ] Syncfusion license if exposed in client bundles

Keep `.env` out of git. Prefer environment injection in the host/orchestrator.
Use long random JWT secrets (32+ bytes).
