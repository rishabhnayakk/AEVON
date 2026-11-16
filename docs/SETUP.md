# Installation and Configuration

## 1. Prerequisites

- Node.js 18 or newer.
- npm.
- MongoDB local instance or MongoDB Atlas database.
- A Groq API key only if live AI features are required.

## 2. Clone the repository

```bash
git clone https://github.com/rishabhnayakk/AEVON.git
cd AEVON
```

For this hardening work, check out the branch or pull request head before testing:

```bash
git fetch origin
git checkout hardening/production-readiness
```

## 3. Install dependencies

The backend package manifest is in `backend/package.json`:

```bash
npm install --prefix backend
```

If the root package defines scripts/dependencies for frontend tooling, install those separately as appropriate. Do not assume a root install installs backend dependencies.

## 4. Configure environment

Create `backend/.env` locally. Never commit this file.

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/aevon
SESSION_SECRET=replace-with-a-unique-random-secret-at-least-32-characters
ALLOWED_ORIGINS=http://localhost:6060
PORT=6060
NODE_ENV=development
GROQ_API_KEY=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-unique-password-of-at-least-12-characters
```

Generate a session secret with a cryptographically secure generator, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Configuration notes:

- `MONGO_URI` is required.
- `SESSION_SECRET` is required and must contain at least 32 characters in this branch.
- `ALLOWED_ORIGINS` is a comma-separated allowlist of browser origins, including scheme and port where applicable. In production it must be explicitly configured.
- `NODE_ENV=production` enables secure session cookie settings and proxy trust for a single trusted reverse proxy. Review your hosting topology before changing this.
- `GROQ_API_KEY` is optional for local fallback functionality, but live AI calls require a valid provider key.
- Keep secrets in your hosting provider's secret manager in production, not in source control.

## 5. Create the first admin

From the repository root:

```bash
node backend/scripts.js setup-admin
```

The setup command is intended to create an administrator only when none exists. It must not be used as a database reset. If `ADMIN_PASSWORD` is omitted, the script generates a password and prints it once; store it securely. The reset command requires an explicit password of at least 12 characters:

```bash
node backend/scripts.js reset-admin
```

Do not use sample/default passwords. Do not run maintenance commands on production until you understand their effects and have a verified backup.

## 6. Start the backend

```bash
npm start --prefix backend
```

The default port in the backend is 6050 unless `PORT` is set. Use the actual configured port when opening the app. The repository README and historical setup text may contain different port examples; the backend's environment setting is authoritative.

## 7. Run tests and syntax checks

```bash
npm test --prefix backend
node --check backend/server.js
node --check backend/models.js
node --check backend/scripts.js
```

## 8. Troubleshooting

| Symptom | Checks |
|---|---|
| Server refuses to start | Confirm `MONGO_URI`, `SESSION_SECRET`, and that MongoDB is reachable |
| Browser requests blocked by CORS | Add the exact frontend origin to `ALLOWED_ORIGINS`; check scheme, hostname, and port |
| Login works but refresh loses session | Confirm MongoDB session store connectivity and cookie/proxy settings |
| AI results use fallback | Check provider key, provider quota/network access, and server logs |
| Uploaded files disappear after deployment | Use persistent object storage or a durable volume; serverless local storage may be ephemeral |
| Admin setup reports an existing admin | Use the documented reset process with an explicit strong password; do not delete collections manually |
