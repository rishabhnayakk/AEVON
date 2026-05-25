/**
 * AEVON — API Client Module
 * Centralized fetch wrapper for all REST API calls.
 * All API functions return Promises with JSON data.
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:6060/api'
    : 'https://aevon-4.onrender.com/api';

/**
 * Generic fetch wrapper with error handling.
 * @param {string} endpoint - API endpoint (e.g., '/auth/login')
 * @param {object} options - Fetch options
 * @returns {Promise<object>} JSON response
 */
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        credentials: 'include', // Send cookies for session
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    };
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    let response;
    try {
        response = await fetch(url, config);
    } catch (networkErr) {
        throw new Error('Network error — is the server running?');
    }

    // Handle empty responses gracefully
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
        // Provide detailed error to help debugging: include status, content-type, and raw body
        const contentType = response.headers.get('content-type') || 'unknown';
        const snippet = text ? text.slice(0, 200) : ''; // avoid huge logs
        console.error('apiFetch parse error:', { endpoint, status: response.status, contentType, snippet, parseErr });
        throw new Error(`Server returned an invalid response (status ${response.status}, content-type ${contentType}). See console for details.`);
    }

    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
}

// ─── Auth API ────────────────────────────────────────────────
const AuthAPI = {
    login: (username, password) =>
        apiFetch('/auth/login', { method: 'POST', body: { username, password } }),
    logout: () =>
        apiFetch('/auth/logout', { method: 'POST' }),
    me: () =>
        apiFetch('/auth/me'),
    changePassword: (current_password, new_password) =>
        apiFetch('/auth/change-password', { method: 'POST', body: { current_password, new_password } }),
};

// ─── Students API ────────────────────────────────────────────
const StudentsAPI = {
    getAll: (params = {}) => {
        // If a string is passed (legacy), convert to object
        if (typeof params === 'string') params = { class_id: params };
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/students${qs ? `?${qs}` : ''}`);
    },
    getById: (id) =>
        apiFetch(`/students/${id}`),
    create: (data) =>
        apiFetch('/students', { method: 'POST', body: data }),
    update: (id, data) =>
        apiFetch(`/students/${id}`, { method: 'PUT', body: data }),
    delete: (id) =>
        apiFetch(`/students/${id}`, { method: 'DELETE' }),
};

// ─── Marks API ───────────────────────────────────────────────
const MarksAPI = {
    getAll: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/marks${qs ? `?${qs}` : ''}`);
    },
    getByStudent: (studentId) =>
        apiFetch(`/marks/student/${studentId}`),
    add: (data) =>
        apiFetch('/marks', { method: 'POST', body: data }),
    addBulk: (marks) =>
        apiFetch('/marks/bulk', { method: 'POST', body: { marks } }),
    update: (id, data) =>
        apiFetch(`/marks/${id}`, { method: 'PUT', body: data }),
    delete: (id) =>
        apiFetch(`/marks/${id}`, { method: 'DELETE' }),
};



// ─── Analytics API ───────────────────────────────────────────
const AnalyticsAPI = {
    overview: (classId, examId) => {
        let q = [];
        if (classId) q.push(`class_id=${classId}`);
        if (examId) q.push(`exam_id=${examId}`);
        return apiFetch(`/analytics/overview${q.length ? `?${q.join('&')}` : ''}`);
    },
    classAnalytics: (classId, examId) =>
        apiFetch(`/analytics/class/${classId}${examId ? `?exam_id=${examId}` : ''}`),
    studentAnalytics: (studentId, examId) =>
        apiFetch(`/analytics/student/${studentId}${examId ? `?exam_id=${examId}` : ''}`),
    getClasses: () =>
        apiFetch('/analytics/classes'),
    getSubjects: (classId) =>
        apiFetch(`/analytics/subjects${classId ? `?class_id=${classId}` : ''}`),
    getSubjectsAll: () =>
        apiFetch('/subjects/all'),
};

// ─── AI API ──────────────────────────────────────────────────
const AIAPI = {
    predict: (studentId) =>
        apiFetch(`/ai/predict/${studentId}`),
    atRisk: (classId) =>
        apiFetch(`/ai/at-risk${classId ? `?class_id=${classId}` : ''}`),
    recommendations: (studentId) =>
        apiFetch(`/ai/recommendations/${studentId}`),
    chat: (message) =>
        apiFetch('/ai/chat', { method: 'POST', body: { message } }),
};

// ─── Admin API ───────────────────────────────────────────────
const AdminAPI = {
    getTeachers: () => apiFetch('/teachers'),
    createTeacher: (username, password) =>
        apiFetch('/teachers', { method: 'POST', body: { username, password } }),
    deleteTeacher: (id) =>
        apiFetch(`/teachers/${id}`, { method: 'DELETE' }),
    assignTeachers: (classId, teacherIds) =>
        apiFetch(`/classes/${classId}`, { method: 'PUT', body: { teacherIds } }),
    createSubject: (name, code, class_id) =>
        apiFetch('/subjects', { method: 'POST', body: { name, code, class_id } }),
    deleteSubject: (id) =>
        apiFetch(`/subjects/${id}`, { method: 'DELETE' }),
    getExams: (classId) =>
        apiFetch(`/exams${classId ? `?class_id=${classId}` : ''}`),
    createExam: (data) =>
        apiFetch('/exams', { method: 'POST', body: data }),
    updateExamStatus: (id, status) =>
        apiFetch(`/exams/${id}/status`, { method: 'PATCH', body: { status } }),
    deleteExam: (id) =>
        apiFetch(`/exams/${id}`, { method: 'DELETE' }),
    resetPassword: (userId, newPassword) =>
        apiFetch('/admin/reset-password', { method: 'POST', body: { userId, newPassword } }),
    toggleBlock: (userId) =>
        apiFetch('/admin/toggle-block', { method: 'POST', body: { userId } }),
};

// ─── Notifications API ─────────────────────────────────────────
const NotificationsAPI = {
    getAll: () => apiFetch('/notifications'),
    create: (message, targetType, targetClassId, targetStudentId) => 
        apiFetch('/notifications', { method: 'POST', body: { message, targetType, targetClassId, targetStudentId } }),
    delete: (id) => apiFetch(`/notifications/${id}`, { method: 'DELETE' }),
};

// ─── Reports API ─────────────────────────────────────────────
const ReportsAPI = {
    downloadStudentReport: async (studentId) => {
        try {
            showToast('Generating PDF report...', 'info');
            const data = await AnalyticsAPI.studentAnalytics(studentId);
            const { jsPDF } = window.jspdf;
            if (!jsPDF) {
                throw new Error('PDF library not loaded. Please refresh the page.');
            }

            const doc = new jsPDF();
            const s = data.student;

            // Header
            doc.setFontSize(22);
            doc.setTextColor(40);
            doc.text('Student Performance Report', 14, 22);
            
            doc.setFontSize(12);
            doc.setTextColor(100);
            doc.text(`AEVON System — ${new Date().toLocaleDateString()}`, 14, 30);
            doc.line(14, 35, 196, 35);

            // Student Info
            doc.setFontSize(14);
            doc.setTextColor(40);
            doc.text('Student Details', 14, 45);
            doc.setFontSize(11);
            doc.text(`Name: ${s.name}`, 14, 52);
            doc.text(`Enrollment No: ${s.enrollment_no}`, 14, 58);
            doc.text(`Class: ${s.class_name}`, 14, 64);
            doc.text(`Class Rank: #${data.rank} of ${data.total_in_class}`, 14, 70);

            // Summary Stats
            doc.setFontSize(14);
            doc.text('Performance Summary', 120, 45);
            doc.setFontSize(11);
            doc.text(`Overall Average: ${data.overall_average}%`, 120, 52);
            
            // Marks Table
            doc.setFontSize(14);
            doc.text('Subject-wise Marks', 14, 85);
            const marksTable = data.subject_marks.map(m => [
                m.subject_name,
                m.marks_obtained,
                m.max_marks,
                `${m.percentage}%`
            ]);
            
            doc.autoTable({
                startY: 90,
                head: [['Subject', 'Obtained', 'Max', 'Percentage']],
                body: marksTable,
                theme: 'grid',
                headStyles: { fillColor: [43, 43, 43] }
            });

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text(`Page ${i} of ${pageCount} — AEVON Official Report`, 14, 285);
            }

            doc.save(`Report_${s.name.replace(/\s+/g, '_')}_${s.enrollment_no}.pdf`);
            showToast('Report downloaded successfully');
        } catch (err) {
            console.error(err);
            showToast('Failed to generate PDF: ' + err.message, 'error');
        }
    },
};

// ─── Materials API ─────────────────────────────────────────────
const MaterialsAPI = {
    getAll: (classId, subjectId) =>
        apiFetch(`/materials?class_id=${classId}&subject_id=${subjectId}`),
    getSubjectsForClass: (classId) =>
        apiFetch(`/materials/subjects/${classId}`),
    create: (data) => apiFetch('/materials', { method: 'POST', body: data }),
    update: (id, data) => apiFetch(`/materials/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiFetch(`/materials/${id}`, { method: 'DELETE' }),
};

// ─── Leaderboard & Privacy API ─────────────────────────────────
const LeaderboardAPI = {
    getClassLeaderboard: (classId) =>
        apiFetch(`/leaderboard/class/${classId}`),
    updateAlias: (studentId, data) =>
        apiFetch(`/students/${studentId}/alias`, { method: 'PUT', body: data }),
};

// ─── Utility: Toast Notifications ────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
}

// ─── Mobile Menu Toggle ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Only inject if there's a sidebar on the page
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const menuBtn = document.createElement('button');
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
    `;
    document.body.appendChild(menuBtn);

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside of it on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && e.target !== menuBtn) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Close sidebar when clicking a nav link on mobile
    sidebar.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && e.target.closest('.nav-item')) {
            sidebar.classList.remove('open');
        }
    });
});
