# Security and Operations

## 1. Security model

AEVON uses server-side sessions. The browser receives a session cookie; the session record is stored in MongoDB through connect-mongo. Passwords are hashed with bcryptjs.

The hardening branch adds:
- Helmet response security headers (Content Security Policy is currently disabled in the Helmet configuration; configure it after testing inline scripts/styles and external assets).
- CORS origin allowlisting in production.
- A 1 MB JSON request-body limit.
- Login rate limiting (10 requests per 15 minutes per limiter key/IP).
- Session ID regeneration after successful login.
- Minimum 32-character session secret validation.
- Student ownership checks on selected student-specific routes.
- Role restrictions on marks listing, at-risk analytics, and exam status updates.
- Non-destructive first-admin setup.

These controls reduce risk but do not constitute a complete security audit.

## 2. Authorization principles

- Authenticate every private route.
- Check role and resource ownership on the server for every read and write.
- Students may access only their own profile, marks, reports, exam attempts, and personal insights.
- Teachers may access only classes assigned to them.
- Only administrators should perform platform-wide user, class, subject, exam configuration, and account administration.
- Never trust a student ID, class ID, role, marks value, or ownership claim supplied by the browser without checking it against the authenticated session and database.

The existing API contains routes implemented at different times. Before production use, review all routes in `backend/server.js`; a `requireLogin` guard alone does not prove that the caller is authorized for the requested resource.

## 3. Session and cookie deployment

For production:
- Use HTTPS.
- Set `NODE_ENV=production`.
- Set a unique, high-entropy `SESSION_SECRET`.
- Configure `ALLOWED_ORIGINS` with exact trusted origins.
- Configure the reverse proxy and Express `trust proxy` setting to match the actual topology.
- Verify cookie `secure` and `sameSite` behaviour across frontend/API domains. Cross-site cookies require compatible browser settings and HTTPS.
- Do not enable wildcard CORS with credentialed requests.

## 4. Secrets and data protection

- Never commit `.env`, API keys, database credentials, session secrets, or generated admin passwords.
- Restrict database network access and use a least-privilege MongoDB account.
- Use TLS for database connections where supported.
- Limit production database access to authorized operators.
- Back up the database regularly and test restoration.
- Avoid logging passwords, session cookies, tokens, full student records, or AI prompts containing personal information.
- Send only the minimum student data required to an external AI provider and disclose this processing to the institution/users as appropriate.

## 5. Input and upload safety

Every route should validate request shape, string lengths, numeric ranges, MongoDB ObjectId formats, and referenced record ownership. File uploads should enforce extension and MIME checks, file size limits, safe filenames, storage isolation, and authorization on download. Do not rely only on a browser-side file accept attribute.

## 6. Data integrity

- Use database backups before migrations or bulk changes.
- Review scripts before running them against a production URI.
- Do not run cleanup/reset utilities against production unless the operation is explicitly intended, approved, and recoverable.
- Keep unique indexes and handle duplicate-key errors as client-visible validation failures rather than generic server errors.
- Consider transactions for multi-collection operations when the MongoDB deployment supports them.

## 7. Production readiness checklist

- [ ] HTTPS and trusted proxy configuration verified.
- [ ] Production environment secrets configured outside source control.
- [ ] Exact CORS origins configured.
- [ ] Authentication and authorization tests cover all roles and resource ownership.
- [ ] Upload endpoints and file downloads security-reviewed.
- [ ] Rate limits cover login and other abuse-sensitive endpoints.
- [ ] Error responses do not leak stack traces or sensitive database details.
- [ ] Database backups and restore procedure tested.
- [ ] Persistent storage configured for uploads/reports.
- [ ] AI data handling reviewed and fallback behaviour tested.
- [ ] CI passes and a staging smoke test is complete.
- [ ] Monitoring, alerting, and log retention configured.
