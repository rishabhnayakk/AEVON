/**
 * AEVON — Unified Frontend Module
 * Combines API Client, Authentication, and Chart utilities.
 * All API functions return Promises with JSON data.
 */

// ─── API BASE ─────────────────────────────────────────────────
const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:6060/api"
    : "https://aevon-4.onrender.com/api"

/**
 * Generic fetch wrapper with error handling.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const config = {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  }
  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body)
  }

  let response
  try {
    response = await fetch(url, config)
  } catch (networkErr) {
    throw new Error("Network error — is the server running?")
  }

  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch (parseErr) {
    const contentType = response.headers.get("content-type") || "unknown"
    const snippet = text ? text.slice(0, 200) : ""
    console.error("apiFetch parse error:", {
      endpoint,
      status: response.status,
      contentType,
      snippet,
      parseErr,
    })
    throw new Error(
      `Server returned an invalid response (status ${response.status}, content-type ${contentType}). See console for details.`,
    )
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`)
  }
  return data
}

// ─── Auth API ────────────────────────────────────────────────
const AuthAPI = {
  login: (username, password) =>
    apiFetch("/auth/login", { method: "POST", body: { username, password } }),
  logout: () => apiFetch("/auth/logout", { method: "POST" }),
  me: () => apiFetch("/auth/me"),
  changePassword: (current_password, new_password) =>
    apiFetch("/auth/change-password", {
      method: "POST",
      body: { current_password, new_password },
    }),
}

// ─── Students API ────────────────────────────────────────────
const StudentsAPI = {
  getAll: (params = {}) => {
    if (typeof params === "string") params = { class_id: params }
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/students${qs ? `?${qs}` : ""}`)
  },
  getById: (id) => apiFetch(`/students/${id}`),
  create: (data) => apiFetch("/students", { method: "POST", body: data }),
  update: (id, data) =>
    apiFetch(`/students/${id}`, { method: "PUT", body: data }),
  delete: (id) => apiFetch(`/students/${id}`, { method: "DELETE" }),
}

// ─── Marks API ───────────────────────────────────────────────
const MarksAPI = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/marks${qs ? `?${qs}` : ""}`)
  },
  getByStudent: (studentId) => apiFetch(`/marks/student/${studentId}`),
  add: (data) => apiFetch("/marks", { method: "POST", body: data }),
  addBulk: (marks) =>
    apiFetch("/marks/bulk", { method: "POST", body: { marks } }),
  update: (id, data) => apiFetch(`/marks/${id}`, { method: "PUT", body: data }),
  delete: (id) => apiFetch(`/marks/${id}`, { method: "DELETE" }),
}

// ─── Analytics API ───────────────────────────────────────────
const AnalyticsAPI = {
  overview: (classId, examId) => {
    let q = []
    if (classId) q.push(`class_id=${classId}`)
    if (examId) q.push(`exam_id=${examId}`)
    return apiFetch(`/analytics/overview${q.length ? `?${q.join("&")}` : ""}`)
  },
  classAnalytics: (classId, examId) =>
    apiFetch(
      `/analytics/class/${classId}${examId ? `?exam_id=${examId}` : ""}`,
    ),
  studentAnalytics: (studentId, examId) =>
    apiFetch(
      `/analytics/student/${studentId}${examId ? `?exam_id=${examId}` : ""}`,
    ),
  getClasses: () => apiFetch("/analytics/classes"),
  getSubjects: (classId) =>
    apiFetch(`/analytics/subjects${classId ? `?class_id=${classId}` : ""}`),
  getSubjectsAll: () => apiFetch("/subjects/all"),
}

// ─── AI API ──────────────────────────────────────────────────
const AIAPI = {
  predict: (studentId) => apiFetch(`/ai/predict/${studentId}`),
  atRisk: (classId) =>
    apiFetch(`/ai/at-risk${classId ? `?class_id=${classId}` : ""}`),
  recommendations: (studentId) => apiFetch(`/ai/recommendations/${studentId}`),
  chat: (message) =>
    apiFetch("/ai/chat", { method: "POST", body: { message } }),
}

// ─── Admin API ───────────────────────────────────────────────
const AdminAPI = {
  getTeachers: () => apiFetch("/teachers"),
  createTeacher: (username, password) =>
    apiFetch("/teachers", { method: "POST", body: { username, password } }),
  deleteTeacher: (id) => apiFetch(`/teachers/${id}`, { method: "DELETE" }),
  assignTeachers: (classId, teacherIds) =>
    apiFetch(`/classes/${classId}`, { method: "PUT", body: { teacherIds } }),
  createSubject: (name, code, class_id) =>
    apiFetch("/subjects", { method: "POST", body: { name, code, class_id } }),
  deleteSubject: (id) => apiFetch(`/subjects/${id}`, { method: "DELETE" }),
  getExams: (classId) =>
    apiFetch(`/exams${classId ? `?class_id=${classId}` : ""}`),
  createExam: (data) => apiFetch("/exams", { method: "POST", body: data }),
  updateExamStatus: (id, status) =>
    apiFetch(`/exams/${id}/status`, { method: "PATCH", body: { status } }),
  deleteExam: (id) => apiFetch(`/exams/${id}`, { method: "DELETE" }),
  resetPassword: (userId, newPassword) =>
    apiFetch("/admin/reset-password", {
      method: "POST",
      body: { userId, newPassword },
    }),
  toggleBlock: (userId) =>
    apiFetch("/admin/toggle-block", { method: "POST", body: { userId } }),
}

// ─── Notifications API ─────────────────────────────────────────
const NotificationsAPI = {
  getAll: () => apiFetch("/notifications"),
  create: (message, targetType, targetClassId, targetStudentId) =>
    apiFetch("/notifications", {
      method: "POST",
      body: { message, targetType, targetClassId, targetStudentId },
    }),
  delete: (id) => apiFetch(`/notifications/${id}`, { method: "DELETE" }),
}

// ─── Reports API ─────────────────────────────────────────────
const ReportsAPI = {
  downloadStudentReport: async (studentId) => {
    try {
      showToast("Generating PDF report...", "info")
      const data = await AnalyticsAPI.studentAnalytics(studentId)
      const { jsPDF } = window.jspdf
      if (!jsPDF) {
        throw new Error("PDF library not loaded. Please refresh the page.")
      }

      const doc = new jsPDF()
      const s = data.student

      doc.setFontSize(22)
      doc.setTextColor(40)
      doc.text("Student Performance Report", 14, 22)

      doc.setFontSize(12)
      doc.setTextColor(100)
      doc.text(`AEVON System — ${new Date().toLocaleDateString()}`, 14, 30)
      doc.line(14, 35, 196, 35)

      doc.setFontSize(14)
      doc.setTextColor(40)
      doc.text("Student Details", 14, 45)
      doc.setFontSize(11)
      doc.text(`Name: ${s.name}`, 14, 52)
      doc.text(`Enrollment No: ${s.enrollment_no}`, 14, 58)
      doc.text(`Class: ${s.class_name}`, 14, 64)
      doc.text(`Class Rank: #${data.rank} of ${data.total_in_class}`, 14, 70)

      doc.setFontSize(14)
      doc.text("Performance Summary", 120, 45)
      doc.setFontSize(11)
      doc.text(`Overall Average: ${data.overall_average}%`, 120, 52)

      doc.setFontSize(14)
      doc.text("Subject-wise Marks", 14, 85)
      const marksTable = data.subject_marks.map((m) => [
        m.subject_name,
        m.marks_obtained,
        m.max_marks,
        `${m.percentage}%`,
      ])

      doc.autoTable({
        startY: 90,
        head: [["Subject", "Obtained", "Max", "Percentage"]],
        body: marksTable,
        theme: "grid",
        headStyles: { fillColor: [43, 43, 43] },
      })

      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(10)
        doc.setTextColor(150)
        doc.text(`Page ${i} of ${pageCount} — AEVON Official Report`, 14, 285)
      }

      doc.save(`Report_${s.name.replace(/\s+/g, "_")}_${s.enrollment_no}.pdf`)
      showToast("Report downloaded successfully")
    } catch (err) {
      console.error(err)
      showToast("Failed to generate PDF: " + err.message, "error")
    }
  },
}

// ─── Materials API ─────────────────────────────────────────────
const MaterialsAPI = {
  getAll: (classId, subjectId) =>
    apiFetch(`/materials?class_id=${classId}&subject_id=${subjectId}`),
  getSubjectsForClass: (classId) => apiFetch(`/materials/subjects/${classId}`),
  create: (data) => apiFetch("/materials", { method: "POST", body: data }),
  update: (id, data) =>
    apiFetch(`/materials/${id}`, { method: "PUT", body: data }),
  delete: (id) => apiFetch(`/materials/${id}`, { method: "DELETE" }),
}

// ─── Leaderboard & Privacy API ─────────────────────────────────
const LeaderboardAPI = {
  getClassLeaderboard: (classId) => apiFetch(`/leaderboard/class/${classId}`),
  updateAlias: (studentId, data) =>
    apiFetch(`/students/${studentId}/alias`, { method: "PUT", body: data }),
}

// ─── Utility: Toast Notifications ────────────────────────────
function showToast(message, type = "success") {
  const existing = document.querySelector(".toast")
  if (existing) existing.remove()

  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => toast.remove(), 4000)
}

// ─── Mobile Menu Toggle ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar")
  if (!sidebar) return

  const menuBtn = document.createElement("button")
  menuBtn.className = "mobile-menu-btn"
  menuBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
    `
  document.body.appendChild(menuBtn)

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation()
    sidebar.classList.toggle("open")
  })

  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains("open")) {
      if (!sidebar.contains(e.target) && e.target !== menuBtn) {
        sidebar.classList.remove("open")
      }
    }
  })

  sidebar.addEventListener("click", (e) => {
    if (window.innerWidth <= 768 && e.target.closest(".nav-item")) {
      sidebar.classList.remove("open")
    }
  })
})

// ─── Authentication ───────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault()
  const username = document.getElementById("username").value.trim()
  const password = document.getElementById("password").value
  const errorEl = document.getElementById("login-error")
  const btn = document.getElementById("login-btn")

  if (!username || !password) {
    errorEl.textContent = "Please enter both username and password."
    errorEl.style.display = "block"
    return
  }

  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span> Signing in...'
  errorEl.style.display = "none"

  try {
    const data = await AuthAPI.login(username, password)
    localStorage.setItem("eduUser", JSON.stringify(data.user))
    redirectByRole(data.user.role)
  } catch (err) {
    errorEl.textContent = err.message || "Login failed. Please try again."
    errorEl.style.display = "block"
  } finally {
    btn.disabled = false
    btn.innerHTML = "Sign In"
  }
}

function redirectByRole(role) {
  const routes = {
    admin: "admin_dashboard.html",
    teacher: "teacher.html",
    student: "student.html",
  }
  window.location.href = routes[role] || "index.html"
}

function getCurrentUser() {
  const data = localStorage.getItem("eduUser")
  return data ? JSON.parse(data) : null
}

async function requireAuth(allowedRoles = []) {
  const user = getCurrentUser()
  if (!user) {
    window.location.href = "index.html"
    return null
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    redirectByRole(user.role)
    return null
  }

  try {
    await AuthAPI.me()
  } catch {
    localStorage.removeItem("eduUser")
    window.location.href = "index.html"
    return null
  }

  return user
}

function setupMobileNavigation() {
  if (document.querySelector(".mobile-top-bar")) return

  const mobileBar = document.createElement("div")
  mobileBar.className = "mobile-top-bar"
  mobileBar.innerHTML = `
        <button class="mobile-menu-toggle" id="mobile-sidebar-toggle" aria-label="Toggle Menu">
            <span style="font-size: 1.5rem; line-height: 1;">☰</span>
        </button>
        <div style="display:flex;align-items:center;gap:8px;">
            <img src="logo.png" alt="AEVON" style="height:28px;width:auto;">
            <span style="font-size:1rem;font-weight:800;color:var(--text-primary);">AEVON</span>
        </div>
        <div style="width:36px;"></div>
    `

  const overlay = document.createElement("div")
  overlay.className = "sidebar-overlay"
  overlay.id = "sidebar-overlay"

  document.body.prepend(overlay)
  document.body.prepend(mobileBar)

  const sidebar = document.querySelector(".sidebar")
  const toggleBtn = document.getElementById("mobile-sidebar-toggle")

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      sidebar.classList.toggle("open")
      overlay.classList.toggle("show")
    })
  }

  if (overlay && sidebar) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open")
      overlay.classList.remove("show")
    })
  }

  document.addEventListener("click", (e) => {
    if (
      sidebar &&
      sidebar.classList.contains("open") &&
      e.target.closest(".nav-item")
    ) {
      sidebar.classList.remove("open")
      overlay.classList.remove("show")
    }
  })
}

function renderSidebar(activePage = "") {
  const user = getCurrentUser()
  if (!user) return

  setupMobileNavigation()

  const navLinks = document.getElementById("nav-links")
  const roleLabel =
    document.getElementById("role-label") ||
    document.getElementById("user-role-label")
  const sidebarHeader = document.querySelector(".sidebar-header")

  if (sidebarHeader) {
    const roleName =
      user.role === "admin"
        ? "Administrator"
        : user.role === "teacher"
          ? "Teacher Panel"
          : "Student Panel"
    sidebarHeader.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;padding:0.25rem 0 0.4rem;">
                <img src="logo.png" alt="AEVON" style="height:36px;width:auto;object-fit:contain;flex-shrink:0;">
                <span style="font-size:1.1rem;font-weight:800;background:linear-gradient(135deg,var(--primary),var(--primary-dark));-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.3px;">AEVON</span>
            </div>
            <div class="user-role" id="role-label">${roleName}</div>
        `
  } else if (roleLabel) {
    roleLabel.textContent =
      user.role === "admin"
        ? "Administrator"
        : user.role === "teacher"
          ? "Teacher Panel"
          : "Student Panel"
  }

  if (!navLinks) return

  let links = []
  if (user.role === "admin") {
    links = [
      { href: "admin_dashboard.html", icon: "•", text: "Global Dashboard" },
      { href: "admin.html", icon: "•", text: "Control Panel" },
      { href: "academics.html", icon: "•", text: "Academics" },
      { href: "students.html", icon: "•", text: "Students" },
      { href: "marks.html", icon: "•", text: "Marks" },
      { href: "exam_admin.html", icon: "•", text: "Exam Portal" },
      { href: "study_material_admin.html", icon: "•", text: "Study Materials" },
      { href: "comparisons.html", icon: "•", text: "Comparisons" },
      { href: "reports.html", icon: "•", text: "Reports" },
    ]
  } else if (user.role === "teacher") {
    links = [
      { href: "teacher.html", icon: "•", text: "Dashboard" },
      { href: "students.html", icon: "•", text: "Students" },
      { href: "marks.html", icon: "•", text: "Marks" },
      { href: "exam_admin.html", icon: "•", text: "Exam Portal" },
      { href: "study_material_admin.html", icon: "•", text: "Study Materials" },
      { href: "comparisons.html", icon: "•", text: "Comparisons" },
      { href: "reports.html", icon: "•", text: "Reports" },
    ]
  } else {
    links = [
      { href: "student.html", icon: "•", text: "Dashboard" },
      { href: "study_planner.html", icon: "•", text: "Study Planner" },
      { href: "exam_portal.html", icon: "•", text: "Exam Portal" },
      { href: "reports.html", icon: "•", text: "Reports" },
    ]
  }

  navLinks.innerHTML = links
    .map(
      (link) => `
        <a href="${link.href}" class="nav-item ${activePage === link.href ? "active" : ""}">
            <span class="icon">${link.icon}</span> ${link.text}
        </a>
    `,
    )
    .join("")
}

async function handleLogout() {
  try {
    await AuthAPI.logout()
  } catch {
    // Ignore errors — just clear local state
  }
  localStorage.removeItem("eduUser")
  window.location.href = "index.html"
}

// ─── Charts ───────────────────────────────────────────────────

const CHART_COLORS = {
  primary: ["#3b82f6", "#475569", "#64748b", "#93c5fd", "#1e293b"],
  gradient: ["#3b82f6", "#64748b", "#93c5fd"],
  rainbow: [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ec4899",
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
    "#14b8a6",
    "#ef4444",
    "#a855f7",
  ],
}

const Charts = {
  _createBar(canvasId, labels, datasets, options = {}) {
    const ctx = document.getElementById(canvasId)
    if (!ctx || typeof Chart === "undefined") return null

    const existing = Chart.getChart(ctx)
    if (existing) existing.destroy()

    const isComparison = datasets.length > 1 || canvasId.includes("comparison")

    return new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: datasets.map((ds, i) => {
          const color =
            ds.color ||
            (isComparison
              ? CHART_COLORS.rainbow[i % CHART_COLORS.rainbow.length]
              : "#3b82f6")
          return {
            label: ds.label,
            data: ds.data,
            backgroundColor: color,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 50,
            ...ds,
          }
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1, position: "top" } },
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.06)" } },
          x: { grid: { display: false } },
        },
        ...options,
      },
    })
  },

  _createLine(canvasId, labels, datasets, options = {}) {
    const ctx = document.getElementById(canvasId)
    if (!ctx || typeof Chart === "undefined") return null

    const existing = Chart.getChart(ctx)
    if (existing) existing.destroy()

    const isComparison = datasets.length > 1 || canvasId.includes("comparison")

    return new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: datasets.map((ds, i) => {
          const color =
            ds.color ||
            (isComparison
              ? CHART_COLORS.rainbow[i % CHART_COLORS.rainbow.length]
              : "#3b82f6")
          return {
            label: ds.label,
            data: ds.data,
            borderColor: color,
            backgroundColor: color + "15",
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8,
            borderWidth: 2.5,
            ...ds,
          }
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: "rgba(0,0,0,0.06)" },
          },
          x: { grid: { display: false } },
        },
        ...options,
      },
    })
  },

  renderSubjectPerformance(canvasId, subjectData) {
    if (!subjectData) return
    const labels = Object.keys(subjectData)
    const values = Object.values(subjectData)
    return this._createBar(canvasId, labels, [
      { label: "Average Score (%)", data: values },
    ])
  },

  renderClassComparison(canvasId, classData) {
    if (!classData || !classData.length) return
    const labels = classData.map((c) => c.class_name)
    const values = classData.map((c) => c.average_percentage)
    return this._createBar(canvasId, labels, [
      { label: "Class Average (%)", data: values },
    ])
  },

  renderStudentPerformance(canvasId, studentData) {
    if (!studentData || !studentData.length) return
    const labels = studentData.map((s) => s.name)
    const values = studentData.map((s) => s.avg_percentage)
    return this._createBar(canvasId, labels, [
      { label: "Student Avg (%)", data: values },
    ])
  },

  renderExamPerformance(canvasId, examData) {
    if (!examData || !examData.length) return
    const labels = examData.map((e) => e.name)
    const values = examData.map((e) => e.avg)
    return this._createLine(canvasId, labels, [
      { label: "Exam Score (%)", data: values },
    ])
  },

  renderPie(canvasId, labels, data, options = {}) {
    const ctx = document.getElementById(canvasId)
    if (!ctx || typeof Chart === "undefined") return null

    const existing = Chart.getChart(ctx)
    if (existing) existing.destroy()

    const isComparison = canvasId.includes("comparison") || labels.length > 1
    const colors = isComparison ? CHART_COLORS.rainbow : ["#3b82f6"]

    return new Chart(ctx, {
      type: options.type || "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderColor: "rgba(255, 255, 255, 0.8)",
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 15, usePointStyle: true },
          },
        },
        cutout: options.type === "pie" ? 0 : "60%",
        ...options,
      },
    })
  },

  renderRadar(canvasId, labels, datasets) {
    const ctx = document.getElementById(canvasId)
    if (!ctx || typeof Chart === "undefined") return null

    const existing = Chart.getChart(ctx)
    if (existing) existing.destroy()

    const isComparison = datasets.length > 1 || canvasId.includes("comparison")

    return new Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets: datasets.map((ds, i) => {
          const color =
            ds.color ||
            (isComparison
              ? CHART_COLORS.rainbow[i % CHART_COLORS.rainbow.length]
              : "#3b82f6")
          return {
            label: ds.label,
            data: ds.data,
            borderColor: color,
            backgroundColor: color + "20",
            pointBackgroundColor: color,
            borderWidth: 2,
            ...ds,
          }
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            grid: { color: "rgba(0,0,0,0.06)" },
            angleLines: { color: "rgba(0,0,0,0.06)" },
            pointLabels: { color: "#64748b", font: { size: 12 } },
            ticks: { display: false },
          },
        },
        plugins: {
          legend: { position: "top" },
        },
      },
    })
  },
}

if (typeof Chart !== "undefined") {
  Chart.defaults.color = "#8d99ae"
  Chart.defaults.borderColor = "rgba(67, 97, 238, 0.1)"
  Chart.defaults.font.family = "'Inter', sans-serif"
}

window.Charts = Charts
window.createBarChart = (id, l, d, o) => Charts._createBar(id, l, d, o)
window.createLineChart = (id, l, d, o) => Charts._createLine(id, l, d, o)
