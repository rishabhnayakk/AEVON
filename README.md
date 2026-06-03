# AEVON — AI-based Education Analyst System

A complete full-stack web application that analyzes student academic performance using AI/ML and provides actionable insights through beautiful interactive dashboards.

## 🌟 Features

### Core Features
- **Student Performance Tracking** — Marks by subject, exam, and class
- **Performance Trends** — Interactive dashboards with visual charts (bar, line, pie, etc.) using Chart.js
- **Exam Portal** — Online examinations with custom configurations (strict forward-only, negative marks, etc.)
- **Study Materials** — Upload and manage study resources (videos, PDFs, links) by class and subject
- **Leaderboard** — View rankings with configurable privacy (anonymous aliases)

### AI Features
- **Performance Analysis & Predictions** — Automated predictions for student success, utilizing LLMs via Groq
- **At-Risk Detection** — Detects students who need academic intervention
- **Personalized Recommendations** — Actionable insights and custom study tips for students

### Dashboards & Management
- **Admin Dashboard** — Complete management of users (teachers, students), classes, subjects, exams, and settings
- **Teacher Dashboard** — Input marks, broadcast notifications, upload study materials, and monitor performance
- **Student Dashboard** — Access to personal marks history, exam portal, study materials, and AI counselor progress reports

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js (Express), MongoDB (Mongoose) |
| Frontend | HTML5, CSS3 (Vanilla), JavaScript |
| Charts | Chart.js |
| AI Provider | Groq Cloud API (`llama-3.3-70b-versatile`) |
| Auth & Sessions | `bcryptjs`, `express-session`, `connect-mongo` |

---

## 🚀 Quick Start

### Prerequisites
- Node.js (version 18 or higher)
- MongoDB (local instance or MongoDB Atlas URI)
- Groq API Key (sign up at [console.groq.com](https://console.groq.com/))

### Setup Steps

1. **Clone the repository** and navigate to the project directory:
   ```bash
   cd EduAnalytics1
   ```

2. **Configure environment variables:**
   Create a `.env` file in the `backend/` directory:
   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/eduanalytics   # Or MongoDB Atlas URL
   SESSION_SECRET=aevon-secret-key-change-this
   PORT=6060
   GROQ_API_KEY=your_groq_api_key_here
   ```

3. **Install dependencies:**
   ```bash
   # Install backend dependencies (the root package.json has a postinstall script to do this)
   npm install
   ```

4. **Initialize/Reset the Admin User:**
   ```bash
   cd backend
   node scripts.js setup-admin
   ```
   *Note: This will clear the database and create a default `admin` user. Check console logs for the generated credentials (or specify `ADMIN_PASSWORD` in your `.env`).*

5. **Start the backend server:**
   ```bash
   # From the root directory:
   npm start
   
   # Or directly inside the backend directory:
   npm run start
   ```

### Accessing the application
- Backend API server runs on **http://localhost:6060**
- Access the frontend by opening the HTML files (e.g., `frontend/index.html`) in a browser or serving them.

---

## 📁 Project Structure

```
EduAnalytics1/
├── backend/
│   ├── .env                 # Environment config (ignored in Git)
│   ├── server.js            # Main Express application & API routing
│   ├── models.js            # Mongoose schemas & MongoDB connection
│   ├── scripts.js           # Administrative helper scripts (setup-admin, cleanup, etc.)
│   ├── package.json         # Backend dependencies & start scripts
│   └── uploads/             # Directory for uploaded files (e.g. study materials)
├── frontend/
│   ├── index.html           # Login page
│   ├── admin_dashboard.html # Main Admin dashboard
│   ├── teacher.html         # Teacher portal
│   ├── student.html         # Student portal
│   ├── exam_admin.html      # Exam manager
│   ├── exam_portal.html     # Student exam interface
│   ├── study_material_admin.html
│   ├── study_planner.html
│   ├── marks.html
│   ├── reports.html
│   ├── css/                 # Vanilla styling system
│   └── js/
│       └── app.js           # API client routing & fetch requests
├── server.js                # Root entrypoint redirecting to backend/server.js
├── vercel.json              # Vercel deployment configuration
└── README.md
```

---

## 🤖 How the AI Models Work

### 1. Performance Analytics & Counselor (Groq API)
The application leverages the **Llama-3.3-70b-versatile** model via the **Groq API** to provide dynamic, context-aware student counselling.
- **Student Performance Analysis**: Takes student marks, averages, and subject data, then prompts the LLM to output a JSON structure containing predictions, risk trends, weaknesses, and custom study advice.
- **Chat Assistant**: Students and teachers can chat with an interactive bot in the dashboard. The prompt includes live performance data as context, ensuring that responses are highly personalized to the student's status.

### 2. At-Risk Student Detection
The system passes student lists to the LLM to classify risk levels (`high` or `medium`). It identifies students whose performance drops below critical benchmarks (e.g., `< 50%` average) and lists specific warning reasons (e.g. "Low marks in Math").

### 3. Graceful Fallbacks
If the Groq API key is not configured, or if the API request fails, the application automatically uses local rule-based helper functions (`generateFallbackAnalysis` and `generateFallbackAtRisk`) to calculate risk levels and generate default predictions/tips without crashing.

---

## 📊 Core API Endpoints

### Authentication
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - Clear user session
- `GET /api/auth/me` - Get current session info
- `POST /api/auth/change-password` - Reset password

### Users & Classes (Admin Only)
- `GET/POST /api/students` - Retrieve / Register students
- `PUT/DELETE /api/students/:id` - Update / Delete students
- `GET/POST/DELETE /api/teachers` - Manage teacher users
- `POST/PUT/DELETE /api/classes` - Manage classes

### Academics & Marks
- `GET/POST /api/marks` - View / Add marks
- `GET /api/marks/student/:id` - Fetch academic history for a student
- `POST /api/marks/bulk` - Import marks in bulk
- `PUT/DELETE /api/marks/:id` - Update or remove marks records

### AI Features (Groq-driven)
- `GET /api/ai/predict/:id` - Retrieve predicted percentages and risk factors
- `GET /api/ai/recommendations/:id` - Dynamic general advice & personalized tips
- `GET /api/ai/at-risk` - Fetch flagged at-risk students for teachers/admin
- `POST /api/ai/chat` - Interact with the AI Counsel assistant

---

## 📜 License

This project is for educational purposes.
