/**
 * AI Service (Groq removed)
 * Provide local, rule-based fallbacks for analysis and chat.
 */

/**
 * Analyze student performance using local fallback rules.
 */
async function analyzeStudent(studentData) {
  return generateFallbackAnalysis(studentData)
}

/**
 * Analyze at-risk students across the system using Groq.
 */
async function analyzeAtRisk(studentsData) {
  return generateFallbackAtRisk(studentsData)
}

// ─── Fallback (no API key) — simple rule-based analysis ──────

function generateFallbackAnalysis(data) {
  const allSubjectsZero =
    data.subjectAverages.length > 0 &&
    data.subjectAverages.every((s) => s.avg === 0)
  const isNewStudent = allSubjectsZero
  const isCriticalZero = false

  const predictions = data.subjectAverages.map((s) => ({
    subject: s.name,
    currentAvg: s.avg,
    predictedNext:
      isNewStudent && !isCriticalZero
        ? 70
        : Math.min(100, Math.round(s.avg * 1.05)),
    trend: isCriticalZero
      ? "critical"
      : isNewStudent
        ? "new_student"
        : s.avg > 60
          ? "stable"
          : "needs_improvement",
  }))

  const minMark = data.subjectAverages.length
    ? Math.min(...data.subjectAverages.map((s) => s.avg))
    : 100

  let riskLevel = "low"
  const reasons = []

  if (isCriticalZero) {
    riskLevel = "high"
    reasons.push("Zero marks recorded in all subjects")
  } else if (!isNewStudent) {
    if (minMark < 50) {
      riskLevel = "high"
      reasons.push("Subject failure (Below 50%)")
    } else if (minMark < 60) {
      riskLevel = "medium"
      reasons.push("Poor subject performance (Below 60%)")
    }
  }

  const weakSubjects =
    !isNewStudent && !isCriticalZero
      ? data.subjectAverages.filter((s) => s.avg < 50).map((s) => s.name)
      : []
  const strongSubjects =
    !isNewStudent && !isCriticalZero
      ? data.subjectAverages.filter((s) => s.avg >= 75).map((s) => s.name)
      : []

  let recommendations = []

  if (isCriticalZero) {
    recommendations = data.subjectAverages.map((s) => ({
      subject: s.name,
      priority: "high",
      message: `CRITICAL: Zero marks in ${s.name}. Immediate action required!`,
      tips: [
        "Contact your teacher immediately to discuss your standing",
        "Complete all missed assignments and catch up on content",
        "Create a daily study schedule for this subject",
        "Consider forming a study group with classmates",
      ],
    }))
  } else if (isNewStudent) {
    recommendations = data.subjectAverages.map((s) => ({
      subject: s.name,
      priority: "medium",
      message: `Get started with ${s.name} — review the syllabus and complete all assignments.`,
      tips: [
        "Read the course material from the beginning",
        "Complete practice exercises regularly",
        "Ask your teacher for a study plan",
      ],
    }))
  } else {
    recommendations = weakSubjects.map((name) => ({
      subject: name,
      priority: "high",
      message: `Focus on ${name} — your average is below 50%.`,
      tips: [
        "Revise fundamentals",
        "Practice past papers",
        "Seek teacher help",
      ],
    }))
  }

  const generalAdvice = []
  if (isCriticalZero) {
    generalAdvice.push("CRITICAL ALERT: Your marks are at zero.")
    generalAdvice.push(
      "Contact your teacher or school administration immediately.",
    )
    generalAdvice.push("You are at serious risk of failing — do not delay.")
  } else if (isNewStudent) {
    generalAdvice.push(
      "Welcome! No marks recorded yet — your journey starts here.",
    )
    generalAdvice.push("Focus on understanding the basics of each subject.")
    generalAdvice.push(
      "Make sure your marks are entered after each test or exam.",
    )
  } else {
    if (data.overallAverage >= 75)
      generalAdvice.push("Excellent performance! Keep it up.")
    else if (data.overallAverage >= 50)
      generalAdvice.push("Good progress. Focus on weak areas.")
    else generalAdvice.push("Needs immediate attention. Create a study plan.")
  }

  return {
    predictions,
    riskLevel,
    riskReasons: reasons,
    recommendations,
    generalAdvice,
    strengths: strongSubjects,
    weaknesses: weakSubjects,
  }
}

function generateFallbackAtRisk(studentsData) {
  const atRiskStudents = studentsData
    .map((s) => {
      const lowSubjects = s.subjectMarks.filter((m) => m.percentage < 60)
      const criticalSubjects = s.subjectMarks.filter((m) => m.percentage < 50)

      let riskLevel = "low"
      const reasons = []

      if (criticalSubjects.length > 0 || s.subjectMarks.length === 0) {
        riskLevel = "high"
        if (s.subjectMarks.length === 0) {
          reasons.push("No marks recorded yet")
        } else {
          criticalSubjects.forEach((m) =>
            reasons.push(`Critical in ${m.subjectName} (${m.percentage}%)`),
          )
        }
      } else if (lowSubjects.length > 0) {
        riskLevel = "medium"
        lowSubjects.forEach((m) =>
          reasons.push(`Low marks in ${m.subjectName} (${m.percentage}%)`),
        )
      }

      const subjectsAtRisk =
        s.subjectMarks.length === 0
          ? ["All Subjects (No Data)"]
          : (riskLevel === "high" ? criticalSubjects : lowSubjects).map(
              (m) => `${m.subjectName} (${m.percentage}%)`,
            )

      return {
        name: s.name,
        className: s.className,
        riskLevel,
        reasons,
        subjects: subjectsAtRisk,
        avgPercentage: s.overallAverage,
      }
    })
    .filter((s) => s.riskLevel !== "low")
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.riskLevel] - order[b.riskLevel]
    })

  return { atRiskStudents }
}

async function chatAssistant(message, dataStr, role) {
  // Chatbot functionality removed — return helpful static guidance only
  if (role === "teacher") {
    // Try to extract student name from message and give a simple heuristic reply
    const nameMatch = message.match(/([A-Z][a-z]+)\b/)
    const studentName = nameMatch ? nameMatch[1] : null
    if (studentName) {
      return `Based on the available data for ${studentName}, review their subject-wise marks and prioritize the lowest scoring subject for targeted support.`
    }
    return "Please specify a student's name for recommendations (e.g., 'Aarav')."
  }
  return "AI chatbot has been disabled by the administrator."
}

module.exports = { analyzeStudent, analyzeAtRisk, chatAssistant }
