# AEVON Documentation

Welcome to the AEVON developer documentation. AEVON is an academic intelligence platform for managing students, classes, subjects, marks, online exams, study materials, notifications, reports, and AI-assisted academic insights.

## Documentation map

- [System architecture](ARCHITECTURE.md) — application layers, data flow, and domain model.
- [Installation and configuration](SETUP.md) — local development, environment variables, admin setup, and common issues.
- [API reference](API.md) — current HTTP routes, access expectations, and response conventions.
- [Security and operations](SECURITY.md) — authentication, authorization, deployment considerations, backups, and operational checks.
- [Testing and contribution](CONTRIBUTING.md) — test commands, CI, coding expectations, and pull-request checklist.

## Project links

- [Source repository](https://github.com/rishabhnayakk/AEVON)
- [Production-readiness hardening PR](https://github.com/rishabhnayakk/AEVON/pull/1)

## Documentation status

These documents describe the repository as inspected on the `hardening/production-readiness` branch. The API is implemented primarily in `backend/server.js`; the data model is in `backend/models.js`. Some endpoint behaviour and response fields are implementation details and may change. Always verify the implementation before integrating a new client.

This is engineering documentation, not a claim that the application has passed a production security audit or end-to-end acceptance testing.
