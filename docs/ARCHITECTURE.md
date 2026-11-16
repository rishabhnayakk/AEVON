# System Architecture

## 1. Overview

AEVON is a browser-based academic management application with a JavaScript frontend, an Express API, MongoDB persistence, and optional LLM-powered academic analysis.

```text
Browser (HTML / CSS / Vanilla JavaScript)
        |
        | HTTP + JSON, session cookie
        v
Express application (backend/server.js)
  | authentication and role checks
  | domain/API handlers
  | AI prompt and fallback functions
  | static frontend and uploaded files
        |
        +---------------------> MongoDB
        |                        Mongoose models
        |                        connect-mongo sessions
        |
        +---------------------> Groq API (optional AI features)
```

## 2. Technology

| Layer | Implementation |
|---|---|
| Frontend | HTML5, CSS, browser JavaScript |
| Backend | Node.js 18+, Express |
| Persistence | MongoDB with Mongoose |
| Sessions | express-session with connect-mongo |
| Password hashing | bcryptjs |
| HTTP hardening | Helmet, CORS allowlist, express-rate-limit |
| Charts | Chart.js (frontend) |
| AI | Groq API when configured, rule-based fallback paths |
| CI | GitHub Actions, Node test runner |

The exact dependency versions are declared in `backend/package.json`.

## 3. Repository layout

- `backend/server.js`: Express initialization, middleware, authentication, API routes, AI orchestration, upload/report endpoints.
- `backend/models.js`: Mongoose schemas, references, indexes, and model exports.
- `backend/scripts.js`: administrative setup and maintenance commands. Review a command before running it against a valuable database.
- `backend/middleware/authz.js`: reusable role guard.
- `backend/test/`: backend unit tests.
- `frontend/`: role-specific pages, shared styles, and browser-side application code.
- `.github/workflows/backend-ci.yml`: backend test and syntax-check workflow.
- `vercel.json`: deployment routing/configuration.

## 4. Roles and responsibilities

| Role | Intended capabilities |
|---|---|
| Admin | Manage users, classes, subjects, exams, configuration, and platform-wide operations |
| Teacher | Work with assigned classes, marks, study resources, notifications, and class insights |
| Student | View their own academic profile, marks, exams, materials, notifications, and personal AI insights |

Authorization must be enforced by the API, not merely by hiding frontend controls. The current hardening branch adds explicit ownership checks to selected student endpoints and teacher class checks to mark operations. Review [API reference](API.md) and [Security](SECURITY.md) before exposing new endpoints.

## 5. Data model

The application exports these Mongoose models:

| Model | Purpose | Important relationships |
|---|---|---|
| User | Login identity, password hash, role, blocked status | Optional link to Student |
| Class | Academic class and assigned teachers | Teacher IDs reference User |
| Student | Student profile, enrollment, alias, badges | Belongs to Class |
| Subject | Subject offered to a class | Belongs to Class |
| Exam | Scheduled academic exam | Belongs to Class |
| Mark | Manual academic mark record | Student, Subject, optional Exam |
| ExamConfig | Online exam timing and scoring settings | One configuration per Exam |
| Question | Online exam question and answer options | Exam and Subject |
| ExamAttempt | Student submission and score | Exam and Student |
| Notification | Targeted announcement | Optional Class or Student target |
| StudyMaterial | Chapter resources and links | Class and Subject |

Important indexes include unique usernames, enrollment numbers, subject/class combinations, exam/class combinations, mark identity, and one attempt per student/exam. Notifications have a TTL index configured for 14 days. MongoDB TTL cleanup is asynchronous; it is not an exact-to-the-second deletion guarantee.

## 6. Request lifecycle

1. The browser sends an HTTP request to the Express server.
2. Session middleware reads the session cookie and loads the session from MongoDB.
3. Authentication middleware verifies a session; role middleware checks the allowed role where applied.
4. The route validates identifiers and request data, applies ownership/class restrictions, and queries Mongoose.
5. The API returns JSON or an uploaded/static resource.
6. AI endpoints call the configured provider when available and use a local fallback where implemented.

## 7. AI integration

AI-related functions live in `backend/server.js`. The README describes Groq and the `llama-3.3-70b-versatile` model. The implementation includes fallback analysis functions. Treat model output as advisory: it must not be the sole basis for high-impact academic decisions. Avoid sending unnecessary personal information to external AI services.

## 8. File handling and reports

Uploaded resources are served from the backend uploads directory. Report generation and file upload routes are implemented in the backend. In production, use durable storage, size/type restrictions, malware scanning where appropriate, and access-controlled download URLs. Local ephemeral filesystem storage should not be assumed to persist on serverless deployments.
