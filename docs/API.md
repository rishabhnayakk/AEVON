# HTTP API Reference

Base URL: the Express server origin, for example `http://localhost:6050`.

Requests use JSON unless an endpoint handles multipart file uploads. Private routes use the session cookie established by login. The API implementation is in `backend/server.js`; use that file as the final authority for exact request and response fields.

## Authentication

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | Public, rate limited | Create authenticated session |
| POST | `/api/auth/logout` | Session | End current session |
| GET | `/api/auth/me` | Authenticated | Return current identity |
| POST | `/api/auth/change-password` | Authenticated | Change own password |

## Students and marks

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/students` | Authenticated | List students subject to role filtering |
| GET | `/api/students/:id` | Authenticated + ownership/class check | Read a student profile |
| POST | `/api/students` | Admin | Create student |
| PUT | `/api/students/:id` | Admin | Update student |
| DELETE | `/api/students/:id` | Admin | Delete student and related records |
| GET | `/api/marks` | Admin or teacher | List marks; teacher results are scoped to assigned classes |
| GET | `/api/marks/student/:id` | Authenticated + ownership/class check | Read marks for a student |
| POST | `/api/marks` | Authenticated; handler applies student/class authorization | Create mark |
| POST | `/api/marks/bulk` | Authenticated; handler applies student/class authorization | Bulk create marks |
| PUT | `/api/marks/:id` | Authenticated; handler applies student/class authorization | Update mark |
| DELETE | `/api/marks/:id` | Authenticated; handler applies student/class authorization | Delete mark |
| DELETE | `/api/attendance/:id` | Authenticated | Delete attendance record (verify backing model/route requirements before use) |

## Analytics and AI

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/analytics/classes` | Authenticated | Class analytics data |
| GET | `/api/analytics/subjects` | Authenticated | Subject analytics data |
| GET | `/api/analytics/overview` | Authenticated | Overview metrics |
| GET | `/api/analytics/class/:id` | Authenticated; class access should be verified | Class analytics |
| GET | `/api/analytics/student/:id` | Authenticated + ownership/class check | Student analytics |
| GET | `/api/ai/predict/:id` | Authenticated + ownership/class check | Student performance prediction |
| GET | `/api/ai/recommendations/:id` | Authenticated + ownership/class check | Personalized recommendations |
| GET | `/api/ai/at-risk` | Admin or teacher | At-risk overview |
| POST | `/api/ai/chat` | Authenticated | Context-aware AI chat |

## Administration and academic setup

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/admin/reset-password` | Admin | Reset an account password |
| POST | `/api/admin/toggle-block` | Admin | Block/unblock an account |
| GET/POST/DELETE | `/api/teachers` and `/api/teachers/:id` | Admin | Manage teachers |
| POST/PUT/DELETE | `/api/classes`, `/api/classes/:id` | Admin | Manage classes |
| GET/POST/DELETE | `/api/subjects/all`, `/api/subjects`, `/api/subjects/:id` | Admin | Manage subjects |
| GET/POST/DELETE | `/api/exams`, `/api/exams/:id` | Authenticated for list; admin for mutations | Manage exams |
| PATCH | `/api/exams/:id/status` | Admin | Change exam status |

## Online exam portal

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/exam-portal/config/:examId` | Authenticated | Read exam configuration |
| POST | `/api/exam-portal/config` | Admin | Configure exam |
| POST/PUT/DELETE | `/api/exam-portal/questions`, `/api/exam-portal/questions/:id` | Admin | Manage question bank |
| GET | `/api/exam-portal/available` | Authenticated | List available exams |
| GET | `/api/exam-portal/start/:examId` | Authenticated | Start/resume exam attempt |
| POST | `/api/exam-portal/submit/:examId` | Authenticated | Submit exam answers |
| GET | `/api/exam-portal/results/:examId` | Authenticated | Read exam result, subject to result visibility rules |

Some exam upload/import routes use dynamically constructed route declarations in the server file and are not fully enumerated in this table.

## Reports, notifications, materials, leaderboard

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/reports/student/:id` | Authenticated | Generate/read student report |
| POST | `/api/notifications` | Authenticated | Create targeted notification |
| GET | `/api/notifications` | Authenticated | List visible notifications |
| DELETE | `/api/notifications/:id` | Authenticated | Delete notification |
| POST | `/api/materials` | Authenticated | Upload/create study material |
| GET | `/api/materials` | Authenticated | List study materials |
| GET | `/api/materials/subjects/:classId` | Authenticated | List materials by class |
| PUT | `/api/materials/:id` | Authenticated | Update material |
| DELETE | `/api/materials/:id` | Authenticated | Delete material |
| GET | `/api/leaderboard/class/:classId` | Authenticated | Class leaderboard |
| PUT | `/api/students/:id/alias` | Authenticated | Update student leaderboard alias |

## Request conventions

- Send JSON with `Content-Type: application/json` for JSON endpoints.
- Preserve the session cookie between requests. Browser clients using cross-origin requests must send credentials and use an explicitly allowed origin.
- IDs in path parameters are MongoDB ObjectIds unless the route implementation documents otherwise.
- Do not infer that an endpoint is safe for every authenticated role from the table alone. Confirm the handler's ownership and role checks before integration.
- Error responses generally contain an `error` string. Exact status codes and payload fields are route-specific.

## Example: login

```bash
curl -i -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}' \
  http://localhost:6050/api/auth/login
```

## Example: current session

```bash
curl -b cookies.txt http://localhost:6050/api/auth/me
```

For complete payload schemas, inspect the relevant route handler and frontend caller. A machine-readable OpenAPI specification should be added once request/response schemas are centralized and validated.
