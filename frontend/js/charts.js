/**
 * AEVON — Chart Rendering Helpers
 * Uses Chart.js (loaded via CDN) to create beautiful, interactive charts.
 */

const CHART_COLORS = {
    primary: ['#3b82f6', '#475569', '#64748b', '#93c5fd', '#1e293b'],
    gradient: ['#3b82f6', '#64748b', '#93c5fd'],
    rainbow: [
        '#3b82f6', // Professional Blue
        '#10b981', // Emerald green
        '#f59e0b', // Amber/Yellow
        '#ec4899', // Pink
        '#8b5cf6', // Violet/Purple
        '#06b6d4', // Cyan
        '#f97316', // Orange
        '#14b8a6', // Teal
        '#ef4444', // Red
        '#a855f7'  // Purple
    ]
};

const Charts = {
    _createBar(canvasId, labels, datasets, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || typeof Chart === 'undefined') return null;
        
        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();

        const isComparison = datasets.length > 1 || canvasId.includes('comparison');
        
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: datasets.map((ds, i) => {
                    const color = ds.color || (isComparison ? CHART_COLORS.rainbow[i % CHART_COLORS.rainbow.length] : '#3b82f6');
                    return {
                        label: ds.label,
                        data: ds.data,
                        backgroundColor: color,
                        borderRadius: 6,
                        borderSkipped: false,
                        maxBarThickness: 50,
                        ...ds,
                    };
                }),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: datasets.length > 1, position: 'top' } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } },
                    x: { grid: { display: false } },
                },
                ...options,
            },
        });
    },

    _createLine(canvasId, labels, datasets, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || typeof Chart === 'undefined') return null;
        
        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();

        const isComparison = datasets.length > 1 || canvasId.includes('comparison');
        
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: datasets.map((ds, i) => {
                    const color = ds.color || (isComparison ? CHART_COLORS.rainbow[i % CHART_COLORS.rainbow.length] : '#3b82f6');
                    return {
                        label: ds.label,
                        data: ds.data,
                        borderColor: color,
                        backgroundColor: color + '15',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        borderWidth: 2.5,
                        ...ds,
                    };
                }),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0,0,0,0.06)' } },
                    x: { grid: { display: false } },
                },
                ...options,
            },
        });
    },

    renderSubjectPerformance(canvasId, subjectData) {
        if (!subjectData) return;
        const labels = Object.keys(subjectData);
        const values = Object.values(subjectData);
        return this._createBar(canvasId, labels, [{ label: 'Average Score (%)', data: values }]);
    },

    renderClassComparison(canvasId, classData) {
        if (!classData || !classData.length) return;
        const labels = classData.map(c => c.class_name);
        const values = classData.map(c => c.average_percentage);
        return this._createBar(canvasId, labels, [{ label: 'Class Average (%)', data: values }]);
    },

    renderStudentPerformance(canvasId, studentData) {
        if (!studentData || !studentData.length) return;
        const labels = studentData.map(s => s.name);
        const values = studentData.map(s => s.avg_percentage);
        return this._createBar(canvasId, labels, [{ label: 'Student Avg (%)', data: values }]);
    },

    renderExamPerformance(canvasId, examData) {
        if (!examData || !examData.length) return;
        const labels = examData.map(e => e.name);
        const values = examData.map(e => e.avg);
        return this._createLine(canvasId, labels, [{ label: 'Exam Score (%)', data: values }]);
    },

    renderPie(canvasId, labels, data, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || typeof Chart === 'undefined') return null;

        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();

        const isComparison = canvasId.includes('comparison') || labels.length > 1;
        const colors = isComparison ? CHART_COLORS.rainbow : ['#3b82f6'];

        return new Chart(ctx, {
            type: options.type || 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 2,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 15, usePointStyle: true },
                    },
                },
                cutout: options.type === 'pie' ? 0 : '60%',
                ...options,
            },
        });
    },

    renderRadar(canvasId, labels, datasets) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || typeof Chart === 'undefined') return null;

        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();

        const isComparison = datasets.length > 1 || canvasId.includes('comparison');

        return new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: datasets.map((ds, i) => {
                    const color = ds.color || (isComparison ? CHART_COLORS.rainbow[i % CHART_COLORS.rainbow.length] : '#3b82f6');
                    return {
                        label: ds.label,
                        data: ds.data,
                        borderColor: color,
                        backgroundColor: color + '20',
                        pointBackgroundColor: color,
                        borderWidth: 2,
                        ...ds,
                    };
                }),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(0,0,0,0.06)' },
                        angleLines: { color: 'rgba(0,0,0,0.06)' },
                        pointLabels: { color: '#64748b', font: { size: 12 } },
                        ticks: { display: false },
                    },
                },
                plugins: {
                    legend: { position: 'top' },
                },
            },
        });
    }
};

// Initialize Chart.js defaults if available
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#8d99ae';
    Chart.defaults.borderColor = 'rgba(67, 97, 238, 0.1)';
    Chart.defaults.font.family = "'Inter', sans-serif";
}

// Assign to window immediately
window.Charts = Charts;

// Legacy compatibility
window.createBarChart = (id, l, d, o) => Charts._createBar(id, l, d, o);
window.createLineChart = (id, l, d, o) => Charts._createLine(id, l, d, o);
