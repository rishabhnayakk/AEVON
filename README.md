# AEVON — Academic Intelligence Platform

> A premium, full-stack EdTech platform for tracking student performance, delivering AI-powered insights, and managing academic operations — built with a production-quality design system.

---

## ✨ What's New

- **Complete UI redesign** — premium design system with Inter typography, refined color palette, and a consistent component library
- **Student dashboard** — overall progress hero strip, 4-stat performance grid, exam accordion ledger
- **Admin dashboard** — responsive auto-fit grids, no horizontal overflow, real-time analytics
- **Sidebar** — modern SVG navigation icons, active state indicators, Sign Out UX
- **All pages** — unified 8px spacing rhythm, refined typography hierarchy, polished interactions

---

## 🌟 Features

### Student Experience
- **Performance Dashboard** — overall average ring, class rank, pass/fail breakdown, exam-wise trend charts
- **Leaderboard** — class rankings with configurable anonymous aliases for privacy
- **Exam Portal** — online examinations with strict forward-only mode, negative marking, and auto-grading
- **Study Materials** — chapter-wise PDFs, videos, links, and teacher-annotated notes
- **AI Counselor** — personalized study recommendations, risk predictions, and interactive chat

### Teacher Tools
- **Mark Entry** — bulk and individual marks management per subject and exam
- **Notifications** — broadcast targeted announcements to individual students or entire classes
- **Study Material Upload** — organize resources by class, subject, and chapter
- **At-Risk Monitor** — AI-flagged students needing intervention with recommended actions

### Admin Control
- **Global Analytics** — system-wide metrics, class comparisons, honor roll, at-risk intervention dashboard
- **User Management** — full CRUD for students, teachers, and class assignments
- **Academic Management** — subjects, exam scheduling, class structures
- **Reports** — one-click PDF generation for student performance reports

### AI Capabilities (Groq LPU™)
- **Performance Predictions** — LLM-powered success probability using `llama-3.3-70b-versatile`
- **At-Risk Detection** — automated classification with reason codes and intervention priorities
- **Personalized Recommendations** — subject-specific study tips and custom action plans
- **AI Chat** — context-aware assistant with live student data injected into the prompt
- **Graceful Fallbacks** — rule-based local engine activates automatically if Groq API is unavailable

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB (Mongoose ODM) |
| **Frontend** | HTML5, Vanilla CSS (custom design system), JavaScript ES2022 |
| **Charts** | Chart.js 4 |
| **AI Provider** | Groq Cloud API — `llama-3.3-70b-versatile` |
| **Auth & Sessions** | `bcryptjs`, `express-session`, `connect-mongo` |
| **File Uploads** | `multer` |
| **PDF Generation** | `puppeteer` |
| **Deployment** | Vercel, MongoDB Atlas |

---

## 🎨 Design System

AEVON uses a custom design system defined in `frontend/css/style.css`.

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `--primary` | `#3157D5` | Brand, CTAs, active states |
| `--primary-dark` | `#243FA3` | Hover states, emphasis |
| `--secondary` | `#6366F1` | Indigo accents |
| `--accent` | `#F59E0B` | Streaks, milestones, important actions |
| `--success` | `#16A34A` | Completed states, pass indicators |
| `--bg` | `#F5F7FB` | Page background |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--text` | `#172033` | Primary text |
| `--text-secondary` | `#667085` | Subtitles, metadata |
| `--border` | `#E4E8F0` | Dividers, card borders |

**Color ratio:** 70% neutral · 20% blue/indigo · 7% orange · 3% green

### Typography

- **Font:** Inter (Google Fonts)
- **Page heading:** 28–32px / 700
- **Section heading:** 18–22px / 600
- **Body:** 14–16px / 400–500
- **Metadata:** 12–13px / 400 / uppercase + letter-spacing

### Spacing
8px base unit — all padding, margin, and gap values are multiples of 8.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+
- **MongoDB** (local or [MongoDB Atlas](https://cloud.mongodb.com))
- **Groq API Key** — [console.groq.com](https://console.groq.com/) (free tier available)

### 1. Clone & Install

```bash
git clone https://github.com/rishabhnayakk/AEVON.git
cd AEVON
npm install
```

### 2. Configure Environment

Create `backend/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/aevon
SESSION_SECRET=your-secret-key-change-this-in-production
PORT=6060
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Initialize Admin Account

```bash
cd backend
node scripts.js setup-admin
```

> Seeds the database with a default admin user. Credentials are printed to the console. Set `ADMIN_PASSWORD` in `.env` to override.

### 4. Start the Server

```bash
# From project root:
npm start
```

Server runs at **http://localhost:6060**

Open `frontend/index.html` in a browser or serve the `frontend/` directory statically.

---

## 📁 Project Structure

```
AEVON/
├── backend/
│   ├── server.js                  # Express app, API routing, middleware
│   ├── models.js                  # Mongoose schemas (User, Student, Class, Subject, Exam, Mark, StudyMaterial)
│   ├── scripts.js                 # Admin setup, seeding, cleanup utilities
│   ├── uploads/                   # Uploaded study material files
│   └── package.json
├── frontend/
│   ├── index.html                 # Landing page + login modal
│   ├── student.html               # Student dashboard (performance, leaderboard, badges)
│   ├── teacher.html               # Teacher portal (marks, notifications, materials)
│   ├── admin.html                 # Admin user & class management
│   ├── admin_dashboard.html       # Global analytics dashboard
│   ├── academics.html             # Subject & exam scheduling (admin)
│   ├── students.html              # Student roster management
│   ├── marks.html                 # Marks entry & management
│   ├── exam_admin.html            # Exam configuration & question bank
│   ├── exam_portal.html           # Student exam interface (live)
│   ├── study_material_admin.html  # Study material upload & management
│   ├── study_planner.html         # Chapter-wise study planner (student)
│   ├── comparisons.html           # Class & student performance comparisons
│   ├── reports.html               # PDF report generation
│   ├── css/
│   │   └── style.css              # Complete design system (2300+ lines)
│   └── js/
│       └── app.js                 # API client, sidebar renderer, chart defaults, auth
├── vercel.json                    # Vercel deployment config
└── README.md
```

---

## 🤖 AI Architecture

All AI features use the **Groq Cloud API** (`llama-3.3-70b-versatile`) for low-latency inference.

### Student Counselor — `GET /api/ai/recommendations/:id`
Injects live student marks, averages, and subject data into a structured prompt. Returns a JSON payload containing:
- Risk level (`low` / `medium` / `high`)
- Predicted final percentage
- Subject-specific weaknesses
- Personalized study tips per subject
- Overall strategic recommendation

### At-Risk Detection — `GET /api/ai/at-risk`
Passes the full class roster to the LLM in a single request. Returns a ranked list of at-risk students with specific warning reasons (e.g. `"Below 40% in 3 consecutive exams"`).

### AI Chat — `POST /api/ai/chat`
Context-aware assistant with the student's full academic history injected as a system message. Responds to free-form questions about performance, study strategies, and upcoming exams.

### Fallback Engine
If the Groq API is unavailable or unconfigured, `generateFallbackAnalysis()` and `generateFallbackAtRisk()` provide rule-based results automatically — the app never crashes due to missing AI.

---

## 📊 API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with email + password |
| `POST` | `/api/auth/logout` | Destroy session |
| `GET` | `/api/auth/me` | Current session user |
| `POST` | `/api/auth/change-password` | Update password |

### Students
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/students` | List all students |
| `POST` | `/api/students` | Create student |
| `PUT` | `/api/students/:id` | Update student |
| `DELETE` | `/api/students/:id` | Delete student |

### Marks & Academics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/marks` | All marks (filterable) |
| `POST` | `/api/marks` | Add mark |
| `POST` | `/api/marks/bulk` | Bulk import marks |
| `PUT` | `/api/marks/:id` | Update mark |
| `DELETE` | `/api/marks/:id` | Delete mark |
| `GET` | `/api/marks/student/:id` | Student's full academic history |
| `GET` | `/api/analytics/student/:id` | Computed analytics (averages, rank, subject breakdown) |

### Exams
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/exams` | List exams |
| `POST` | `/api/exams` | Create exam |
| `DELETE` | `/api/exams/:id` | Delete exam |
| `POST` | `/api/exams/:id/submit` | Submit exam (student) |

### AI Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ai/predict/:id` | Risk prediction + performance forecast |
| `GET` | `/api/ai/recommendations/:id` | Personalized study recommendations |
| `GET` | `/api/ai/at-risk` | Class-wide at-risk student list |
| `POST` | `/api/ai/chat` | AI counselor chat message |

---

## 🚢 Deployment

Configured for **Vercel** via `vercel.json`.

```bash
npm i -g vercel
vercel --prod
```

Set these environment variables in your Vercel project dashboard:
- `MONGO_URI`
- `SESSION_SECRET`
- `GROQ_API_KEY`

---

## 📜 License

Built for educational purposes by **Rishabh Nayak**.

> *"Believe in Change."*
