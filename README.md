# AEVON — AI-based Education Analyst System

A complete full-stack web application that analyzes student academic performance using AI/ML and provides actionable insights through beautiful interactive dashboards.

## 🌟 Features

### Core Features
- **Student Performance Tracking** — Marks by subject, semester, and class
- **Attendance Tracking** — Daily attendance recording and analysis
- **Performance Trends** — Interactive charts (bar, line, pie, radar)
- **Weak Subject Identification** — Auto-detect subjects needing attention
- **Class Comparison & Rankings** — Compare classes and rank students

### AI Features
- **Performance Prediction** — Linear Regression predicts next-semester marks
- **At-Risk Detection** — Identifies students at academic risk
- **Study Recommendations** — Personalized, actionable study tips

### Dashboards
- **Admin Dashboard** — System-wide analytics, all classes, all students
- **Teacher Dashboard** — Class-specific performance and attendance
- **Student Dashboard** — Personal progress, predictions, and recommendations

### Additional
- **Role-Based Authentication** — Admin, Teacher, Student access control
- **PDF Report Generation** — Download formatted academic reports
- **REST API** — Full API for all functionalities

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python 3.10+, Flask |
| Frontend | HTML5, CSS3, JavaScript |
| Charts | Chart.js |
| Database | SQLite3 |
| AI/ML | scikit-learn (Linear Regression) |
| PDF | ReportLab |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10 or higher
- pip (Python package manager)

### Setup Steps

```bash
# 1. Navigate to backend directory
cd AEVON/backend

# 2. Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the application (auto-creates DB and seeds sample data)
python app.py
```

### Access the Application
Open your browser and go to: **http://localhost:5000**

### Demo Credentials

The admin account is created by `backend/setup_admin.js`.
Set `ADMIN_PASSWORD` in your environment before running the script, or the script will generate a secure password and print it during setup.

---

## 📁 Project Structure

```
AEVON/
├── backend/
│   ├── app.py               # Main Flask application
│   ├── config.py             # Configuration settings
│   ├── models.py             # Database helpers
│   ├── auth.py               # Authentication & access control
│   ├── schema.sql            # Database schema (DDL)
│   ├── seed_data.py          # Sample data generator
│   ├── requirements.txt      # Python dependencies
│   ├── api/
│   │   ├── students.py       # Student CRUD API
│   │   ├── marks.py          # Marks CRUD API
│   │   ├── attendance.py     # Attendance API
│   │   ├── analytics.py      # Dashboard analytics API
│   │   └── reports.py        # PDF report generation
│   └── ai/
│       ├── predictor.py      # ML performance prediction
│       └── recommender.py    # Study recommendations
├── frontend/
│   ├── index.html            # Login page
│   ├── admin.html            # Admin dashboard
│   ├── teacher.html          # Teacher dashboard
│   ├── student.html          # Student dashboard
│   ├── students.html         # Student management
│   ├── attendance.html       # Attendance tracker
│   ├── reports.html          # Report generation
│   ├── css/style.css         # Design system
│   └── js/
│       ├── api.js            # API client
│       ├── auth.js           # Auth logic
│       └── charts.js         # Chart helpers
└── README.md
```

---

## 🤖 How the AI Models Work

### 1. Performance Prediction (Linear Regression)

```
Input:  Student's marks across semesters for each subject
        e.g., Sem1: 65, Sem2: 70, Sem3: 72

Model:  y = mx + b  (where x = semester, y = marks%)

Output: Predicted marks for the next semester
        e.g., Sem4: ~76% (extrapolation)
```

**Why Linear Regression?**
- Simple and interpretable
- Works well for trend extrapolation
- The slope `m` tells us if a student is improving (positive) or declining (negative)
- R² score indicates prediction confidence

### 2. At-Risk Student Detection

Uses a **weighted scoring system**:
- Average marks < 40% → +3 risk points
- Average marks < 55% → +1 risk point
- Attendance < 75% → +2 risk points
- Declining trend (slope < -3) → +2 risk points

**Risk Levels:**
- ≥ 4 points → HIGH risk
- ≥ 2 points → MEDIUM risk
- ≥ 1 point → LOW risk

### 3. Personalized Recommendations

Rule-based engine that analyzes:
- Per-subject performance vs. class average
- Attendance patterns per subject
- Overall academic standing

Generates targeted, actionable study tips based on the specific areas where a student needs improvement.

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Current user info |
| GET/POST | `/api/students` | List/Create students |
| GET/PUT/DELETE | `/api/students/<id>` | Student CRUD |
| GET/POST | `/api/marks` | List/Add marks |
| GET | `/api/marks/student/<id>` | Student marks |
| GET/POST | `/api/attendance` | List/Record attendance |
| GET | `/api/attendance/student/<id>` | Student attendance |
| GET | `/api/analytics/overview` | Admin overview |
| GET | `/api/analytics/class/<id>` | Class analytics |
| GET | `/api/analytics/student/<id>` | Student analytics |
| GET | `/api/ai/predict/<id>` | AI predictions |
| GET | `/api/ai/at-risk` | At-risk students |
| GET | `/api/ai/recommendations/<id>` | Study tips |
| GET | `/api/reports/student/<id>` | Download PDF |

---

## 📝 Database Schema

- **users** — Login credentials and roles
- **classes** — Class/section definitions
- **students** — Student profiles
- **subjects** — Subjects per class
- **marks** — Student marks per subject per semester
- **attendance** — Daily attendance records

See `backend/schema.sql` for the full DDL.

---

## 🎨 Sample Data

The system auto-seeds with:
- 30 students across 3 classes (CS-A, CS-B, IT-A)
- 5 subjects per class
- 4 semesters of marks data
- 60 days of attendance records per student
- 1 admin + 3 teachers + 30 student user accounts

---

## 📜 License

This project is for educational purposes.
