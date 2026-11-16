# Testing and Contribution Guide

## Development workflow

1. Create a focused branch from the current target branch.
2. Make a small, cohesive change.
3. Add or update tests for changed behaviour.
4. Run tests and syntax checks locally.
5. Update documentation when routes, environment variables, data models, or user workflows change.
6. Open a pull request with scope, screenshots where relevant, test evidence, risks, and migration notes.

## Backend commands

From the repository root:

```bash
npm install --prefix backend
npm test --prefix backend
node --check backend/server.js
node --check backend/models.js
node --check backend/scripts.js
```

The backend tests use Node's built-in `node:test` runner. The current test suite includes role-guard unit tests. It does not yet represent full API integration coverage.

## CI

The GitHub Actions workflow at `.github/workflows/backend-ci.yml` installs backend dependencies, runs the backend test script, and checks JavaScript syntax for core backend files. Confirm the workflow has completed successfully in GitHub before merging. A workflow definition is not proof that CI has passed.

## Coding expectations

- Keep route handlers readable; move repeated authorization and validation into tested middleware/helpers.
- Validate request bodies and path/query parameters on the server.
- Enforce role and resource ownership for both reads and writes.
- Never trust IDs or role information supplied by the client.
- Use async error handling consistently and avoid returning internal stack traces or sensitive database errors.
- Keep secrets out of code and logs.
- Prefer database indexes for invariants that must hold under concurrent requests.
- Avoid destructive scripts; require explicit confirmation and backups for destructive maintenance.
- Keep frontend changes responsive and test keyboard accessibility and loading/error/empty states.

## Pull-request checklist

- [ ] Scope and user impact are explained.
- [ ] Authorization has been tested for admin, teacher, and student roles.
- [ ] Invalid IDs, missing fields, oversized values, and unauthorized resource IDs are tested.
- [ ] Relevant tests were added and pass.
- [ ] CI is green.
- [ ] No secrets, credentials, or personal student data are committed.
- [ ] Documentation and environment examples are updated.
- [ ] Database changes include migration/rollback notes.
- [ ] Frontend regression checks are complete where applicable.
