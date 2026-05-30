/**
 * AEVON — Authentication Module
 * Handles login, logout, session persistence, and role-based redirects.
 */

/**
 * Handle login form submission.
 * @param {Event} e - Form submit event
 */
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
    // Store user info in localStorage for quick access
    localStorage.setItem("eduUser", JSON.stringify(data.user))
    // Redirect based on role
    redirectByRole(data.user.role)
  } catch (err) {
    errorEl.textContent = err.message || "Login failed. Please try again."
    errorEl.style.display = "block"
  } finally {
    btn.disabled = false
    btn.innerHTML = "Sign In"
  }
}

/**
 * Redirect user to the appropriate dashboard based on role.
 */
function redirectByRole(role) {
  const routes = {
    admin: "admin_dashboard.html",
    teacher: "teacher.html",
    student: "student.html",
  }
  window.location.href = routes[role] || "index.html"
}

/**
 * Get current user from localStorage.
 * @returns {object|null}
 */
function getCurrentUser() {
  const data = localStorage.getItem("eduUser")
  return data ? JSON.parse(data) : null
}

/**
 * Check if user is authenticated. Redirect to login if not.
 * @param {string[]} allowedRoles - Roles allowed to access this page
 */
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

  // Verify session is still valid with backend
  try {
    await AuthAPI.me()
  } catch {
    localStorage.removeItem("eduUser")
    window.location.href = "index.html"
    return null
  }

  return user
}

/**
 * Handle logout.
 */
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

/**
 * Render a consistent sidebar based on user role.
 * @param {string} activePage - The filename of the current page to highlight
 */
function renderSidebar(activePage = "") {
  const user = getCurrentUser()
  if (!user) return

  setupMobileNavigation()

  const navLinks = document.getElementById("nav-links")
  const roleLabel =
    document.getElementById("role-label") ||
    document.getElementById("user-role-label")
  const sidebarHeader = document.querySelector(".sidebar-header")

  // Inject logo into sidebar header
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

/**
 * Handle logout.
 */
async function handleLogout() {
  try {
    await AuthAPI.logout()
  } catch {
    // Ignore errors — just clear local state
  }
  localStorage.removeItem("eduUser")
  window.location.href = "index.html"
}
