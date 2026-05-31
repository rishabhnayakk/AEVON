require("dotenv").config()

const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const session = require("express-session")
const { MongoStore } = require("connect-mongo")
const bcrypt = require("bcryptjs")
const path = require("path")

const MONGO_URI = process.env.MONGO_URI
const SESSION_SECRET = process.env.SESSION_SECRET
const PORT = process.env.PORT || 6050

const {
  User,
  Class,
  Student,
  Subject,
  Mark,
  Exam,
  ExamConfig,
  Question,
  ExamAttempt,
  Notification,
  StudyMaterial,
} = require("./models")


const app = express()

// Middleware
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: "10mb" }))
const isProd = process.env.NODE_ENV === "production"
if (isProd) {
  app.set("trust proxy", 1)
}

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: "sessions",
      ttl: 7 * 24 * 60 * 60, // 7 days
    }),
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
    },
  }),
)

// Serve frontend
app.use(express.static(path.join(__dirname, "..", "frontend")))
// Serve uploaded media
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

const fs = require("fs")
const uploadsDir = path.join(__dirname, "uploads", "questions")
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
const materialsDir = path.join(__dirname, "uploads", "materials")
if (!fs.existsSync(materialsDir))
  fs.mkdirSync(materialsDir, { recursive: true })

// Auth middleware
function requireLogin(req, res, next) {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not authenticated" })
  next()
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" })
  }
  next()
}

async function getTeacherClasses(userId) {
  const classes = await Class.find({ teacherIds: userId })
  return classes.map((c) => c._id)
}

async function filterRealMarks(marks, onlyPublished = false) {
  const filtered = []
  const groups = {} // studentId_subjectId

  let publishedIds = null
  if (onlyPublished) {
    // Fetch all published exam IDs
    const publishedConfigs = await mongoose
      .model("ExamConfig")
      .find({ resultsVisible: true }, "examId")
    publishedIds = new Set(publishedConfigs.map((c) => c.examId.toString()))
  }

  marks.forEach((m) => {
    const key = `${m.studentId}_${m.subjectId?._id || m.subjectId}`
    if (!groups[key]) groups[key] = []
    groups[key].push(m)
  })
  Object.values(groups).forEach((group) => {
    // Only include exam marks if they are published (if filtering is enabled)
    const examMarks = group.filter((m) => {
      if (!m.examId) return false
      if (onlyPublished) {
        return (
          publishedIds.has(m.examId.toString()) ||
          publishedIds.has(m.examId?._id?.toString())
        )
      }
      return true
    })

    if (examMarks.length) {
      filtered.push(...examMarks)
    } else {
      // Fallback to manual/legacy marks (where examId is null)
      const manualMarks = group.filter((m) => !m.examId)
      filtered.push(...manualMarks)
    }
  })
  return filtered
}

async function checkAndAwardBadges(studentId) {
  try {
    const student = await Student.findById(studentId)
    if (!student) return

    // Fetch student's marks and populate subjectId and examId
    const marks = await Mark.find({ studentId }).populate("subjectId examId")
    // Filter them as if we are a student (show only published marks)
    const filteredMarks = await filterRealMarks(marks, true)

    const earnedBadges = student.badges || []
    const newBadges = []

    // Helper to check if badge already exists
    const hasBadge = (name) => earnedBadges.some((b) => b.name === name)

    // 1. Math Wizard: >= 85% average in Math subjects (subject name contains 'math' case-insensitively)
    if (!hasBadge("Math Wizard")) {
      const mathMarks = filteredMarks.filter(
        (m) =>
          m.subjectId &&
          m.subjectId.name &&
          m.subjectId.name.toLowerCase().includes("math"),
      )
      if (mathMarks.length > 0) {
        const totalObtained = mathMarks.reduce(
          (sum, m) => sum + m.marksObtained,
          0,
        )
        const totalMax = mathMarks.reduce((sum, m) => sum + m.maxMarks, 0)
        const mathAvg = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
        if (mathAvg >= 85) {
          newBadges.push({
            name: "Math Wizard",
            description:
              "Achieve an average of 85% or higher in Math subjects.",
            icon: "🧙‍♂️",
          })
        }
      }
    }

    // 2. Perfect Score: 100% in any subject in any exam
    if (!hasBadge("Perfect Score")) {
      const perfectScoreExists = filteredMarks.some(
        (m) => Math.round((m.marksObtained / m.maxMarks) * 100) >= 100,
      )
      if (perfectScoreExists) {
        newBadges.push({
          name: "Perfect Score",
          description: "Score 100% in any subject exam.",
          icon: "💯",
        })
      }
    }

    // Sort/group exams chronologically to check Streak, Consistent Performer, and Most Improved.
    const examMarks = filteredMarks.filter((m) => m.examId)
    const examsGrouped = {}
    examMarks.forEach((m) => {
      const examIdStr = m.examId._id.toString()
      if (!examsGrouped[examIdStr]) {
        examsGrouped[examIdStr] = {
          exam: m.examId,
          marks: [],
        }
      }
      examsGrouped[examIdStr].marks.push(m)
    })

    const examList = Object.values(examsGrouped)
      .map((g) => {
        const totalObtained = g.marks.reduce(
          (sum, m) => sum + m.marksObtained,
          0,
        )
        const totalMax = g.marks.reduce((sum, m) => sum + m.maxMarks, 0)
        const avg = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
        return {
          date: new Date(g.exam.date || g.exam.createdAt),
          avg: Math.round(avg),
        }
      })
      .sort((a, b) => a.date - b.date) // ascending chronological order

    // 3. Streak Master: >= 90% in 3 consecutive exams
    if (!hasBadge("Streak Master") && examList.length >= 3) {
      let streak = 0
      let hasStreakOf3 = false
      for (const ex of examList) {
        if (ex.avg >= 90) {
          streak++
          if (streak >= 3) {
            hasStreakOf3 = true
            break
          }
        } else {
          streak = 0
        }
      }
      if (hasStreakOf3) {
        newBadges.push({
          name: "Streak Master",
          description: "Achieve 90% or higher in three consecutive exams.",
          icon: "🔥",
        })
      }
    }

    // 4. Consistent Performer: >= 75% in >= 3 exams
    if (!hasBadge("Consistent Performer") && examList.length >= 3) {
      const consistentCount = examList.filter((ex) => ex.avg >= 75).length
      if (consistentCount >= 3) {
        newBadges.push({
          name: "Consistent Performer",
          description: "Achieve 75% or higher in at least three exams.",
          icon: "🌟",
        })
      }
    }

    // 5. Most Improved: >= 15% improvement between consecutive exam averages
    if (!hasBadge("Most Improved") && examList.length >= 2) {
      let has15PercentJump = false
      for (let i = 1; i < examList.length; i++) {
        if (examList[i].avg - examList[i - 1].avg >= 15) {
          has15PercentJump = true
          break
        }
      }
      if (has15PercentJump) {
        newBadges.push({
          name: "Most Improved",
          description:
            "Improve your overall exam score by 15% or more between consecutive exams.",
          icon: "📈",
        })
      }
    }

    if (newBadges.length > 0) {
      if (!student.badges) student.badges = []
      student.badges.push(...newBadges)
      await student.save()

      // Create notification alerts for each badge earned
      for (const badge of newBadges) {
        await Notification.create({
          message: `Congratulations! You've unlocked the "${badge.name}" badge ${badge.icon}!`,
          senderRole: "admin",
          senderName: "System",
          targetType: "student",
          targetStudentId: student._id,
        })
      }
    }
  } catch (err) {
    console.error("Error checking badges:", err)
  }
}

// ─── AUTH ROUTES ─────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body
    const user = await User.findOne({ username })
    if (!user) return res.status(401).json({ error: "Invalid credentials" })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: "Invalid credentials" })

    if (user.isBlocked) {
      return res
        .status(403)
        .json({
          error:
            "Your account has been blocked. Please contact the administrator.",
        })
    }

    req.session.userId = user._id
    req.session.role = user.role
    res.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        student_id: user.studentId?.toString() || null,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy()
  res.json({ success: true })
})

app.get("/api/auth/me", requireLogin, async (req, res) => {
  const user = await User.findById(req.session.userId)
  if (!user) return res.status(401).json({ error: "Session expired" })
  res.json({
    user: {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      student_id: user.studentId?.toString() || null,
    },
  })
})

// Change password
app.post("/api/auth/change-password", requireLogin, async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    if (!current_password || !new_password)
      return res.status(400).json({ error: "Both fields required" })
    if (new_password.length < 4)
      return res
        .status(400)
        .json({ error: "Password must be at least 4 characters" })
    const user = await User.findById(req.session.userId)
    if (!user) return res.status(401).json({ error: "Session expired" })
    const valid = await bcrypt.compare(current_password, user.password)
    if (!valid)
      return res.status(401).json({ error: "Current password is incorrect" })
    user.password = await bcrypt.hash(new_password, 10)
    await user.save()
    res.json({ message: "Password changed successfully" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── STUDENTS ROUTES ─────────────────────────────────────────
app.get("/api/students", requireLogin, async (req, res) => {
  let filter =
    req.query.class_id && req.query.class_id !== "all"
      ? { classId: req.query.class_id }
      : {}

  if (req.session.role === "teacher") {
    const teacherClassIds = await getTeacherClasses(req.session.userId)
    if (req.query.class_id && req.query.class_id !== "all") {
      if (
        !teacherClassIds.map((id) => id.toString()).includes(req.query.class_id)
      ) {
        return res.json({ students: [] })
      }
    } else {
      filter = { classId: { $in: teacherClassIds } }
    }
  }

  const students = await Student.find(filter).populate("classId")

  // Map users to students for password resets and blocking
  const users = await User.find({
    studentId: { $in: students.map((s) => s._id) },
  })
  const userMap = {}
  users.forEach(
    (u) =>
      (userMap[u.studentId.toString()] = {
        id: u._id.toString(),
        isBlocked: u.isBlocked,
      }),
  )

  res.json({
    students: students.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      email: s.email,
      enrollment_no: s.enrollmentNo,
      class_id: s.classId?._id?.toString() || s.classId?.toString(),
      class_name: s.classId?.name || "",
      user_id: userMap[s._id.toString()]?.id?.toString() || null,
      is_blocked: userMap[s._id.toString()]?.isBlocked || false,
    })),
  })
})

app.get("/api/students/:id", requireLogin, async (req, res) => {
  const s = await Student.findById(req.params.id).populate("classId")
  if (!s) return res.status(404).json({ error: "Not found" })
  res.json({
    id: s._id.toString(),
    name: s.name,
    email: s.email,
    enrollment_no: s.enrollmentNo,
    class_id: s.classId?._id?.toString(),
    class_name: s.classId?.name || "",
  })
})

app.post("/api/students", requireAdmin, async (req, res) => {
  try {
    const s = await Student.create({
      name: req.body.name,
      email: req.body.email || "",
      enrollmentNo: req.body.enrollment_no,
      classId: req.body.class_id,
    })
    // Auto-create user account (email = username, name = password)
    if (req.body.email) {
      const existing = await User.findOne({ username: req.body.email })
      if (!existing) {
        const pwd = await bcrypt.hash(req.body.name, 10)
        await User.create({
          username: req.body.email,
          password: pwd,
          role: "student",
          studentId: s._id,
        })
      }
    }

    // Auto-seed 0 marks for every subject in the class (so student always has data)
    const subjects = await Subject.find({ classId: req.body.class_id })
    const markInserts = subjects.map((sub) => ({
      studentId: s._id,
      subjectId: sub._id,
      marksObtained: 0,
      maxMarks: 100,
    }))
    if (markInserts.length) await Mark.insertMany(markInserts)

    res.json({
      id: s._id.toString(),
      message: "Created",
      marks_seeded: markInserts.length,
    })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.put("/api/students/:id", requireAdmin, async (req, res) => {
  await Student.findByIdAndUpdate(req.params.id, {
    name: req.body.name,
    email: req.body.email || "",
    enrollmentNo: req.body.enrollment_no,
    classId: req.body.class_id,
  })
  res.json({ message: "Updated" })
})

app.delete("/api/students/:id", requireAdmin, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
    if (!student) return res.status(404).json({ error: "Student not found" })
    // Cascade: delete marks, attempts, linked user account and notifications
    await Promise.all([
      Mark.deleteMany({ studentId: req.params.id }),
      ExamAttempt.deleteMany({ studentId: req.params.id }),
      Notification.deleteMany({ targetStudentId: req.params.id }),
      User.findOneAndDelete({ studentId: req.params.id }),
      Student.findByIdAndDelete(req.params.id),
    ])
    res.json({ message: "Student and all related data deleted" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── MARKS ROUTES ────────────────────────────────────────────
app.get("/api/marks", requireLogin, async (req, res) => {
  try {
    const filter = {}
    if (req.query.student_id) filter.studentId = req.query.student_id
    if (req.query.subject_id) filter.subjectId = req.query.subject_id
    if (req.query.exam_id) filter.examId = req.query.exam_id

    // Handle filtering marks by class
    if (req.query.class_id && req.query.class_id !== "all") {
      const studentsInClass = await Student.find({
        classId: req.query.class_id,
      })
      const studentIds = studentsInClass.map((s) => s._id)
      filter.studentId = { $in: studentIds }
    }

    const marks = await Mark.find(filter).populate("subjectId examId")
    res.json({
      marks: marks.map((m) => ({
        id: m._id.toString(),
        student_id: m.studentId.toString(),
        exam_id: m.examId ? (m.examId._id || m.examId).toString() : null,
        exam_name: m.examId?.name || "N/A",
        marks_obtained: m.marksObtained,
        max_marks: m.maxMarks || m.examId?.totalMarks || 100,
        subject_id: m.subjectId
          ? (m.subjectId._id || m.subjectId).toString()
          : null,
        subject_name: m.subjectId?.name || "",
        percentage: Math.round(
          (m.marksObtained / (m.maxMarks || m.examId?.totalMarks || 100)) * 100,
        ),
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/marks/student/:id", requireLogin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ error: "Invalid ID" })
    const student = await Student.findById(req.params.id).populate("classId")
    if (!student) return res.status(404).json({ error: "Student not found" })

    if (req.session.role === "teacher") {
      if (!student.classId) {
        return res
          .status(403)
          .json({
            error: "Access denied: This student is not assigned to any class",
          })
      }
      const teacherClassIds = await getTeacherClasses(req.session.userId)
      if (
        !teacherClassIds
          .map((id) => id.toString())
          .includes(student.classId._id.toString())
      ) {
        return res
          .status(403)
          .json({
            error: "Access denied: This student is not in your assigned class",
          })
      }
    }

    const [marks, subjects] = await Promise.all([
      Mark.find({ studentId: req.params.id }).populate("subjectId examId"),
      student.classId ? Subject.find({ classId: student.classId._id }) : [],
    ])

    const result = marks.map((m) => ({
      id: m._id.toString(),
      subject_id: m.subjectId?._id?.toString(),
      subject_name: m.subjectId?.name || "Unknown",
      exam_id: m.examId?._id?.toString(),
      exam_name: m.examId?.name || "No Exam",
      marks_obtained: m.marksObtained,
      max_marks: m.maxMarks,
      percentage: Math.round((m.marksObtained / m.maxMarks) * 100),
      is_default: false,
    }))

    res.json({ marks: result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/marks", requireLogin, async (req, res) => {
  try {
    const { student_id, subject_id, exam_id, marks_obtained } = req.body
    const marksValue = Number(marks_obtained)

    if (exam_id) {
      const exam = await Exam.findById(exam_id)
      if (!exam) return res.status(404).json({ error: "Exam not found" })
      if (exam.status !== "completed") {
        return res
          .status(400)
          .json({ error: "Marks can only be uploaded after exam completion." })
      }
      if (marksValue > exam.totalMarks) {
        return res
          .status(400)
          .json({
            error: `Marks (${marksValue}) cannot exceed total exam marks (${exam.totalMarks})`,
          })
      }
    }

    const maxMarks =
      req.body.max_marks ||
      (exam_id ? (await Exam.findById(exam_id)).totalMarks : 100)

    const m = await Mark.findOneAndUpdate(
      { studentId: student_id, subjectId: subject_id, examId: exam_id || null },
      { marksObtained: marksValue, maxMarks },
      { upsert: true, new: true },
    )
    await checkAndAwardBadges(student_id)
    res.json({ id: m._id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/marks/bulk", requireLogin, async (req, res) => {
  try {
    const operations = (req.body.marks || []).map((m) => ({
      updateOne: {
        filter: {
          studentId: m.student_id,
          subjectId: m.subject_id,
          examId: m.exam_id || null,
        },
        update: {
          marksObtained: m.marks_obtained,
          maxMarks: m.max_marks || 100,
        },
        upsert: true,
      },
    }))
    if (operations.length > 0) {
      await Mark.bulkWrite(operations)
      const studentIds = [
        ...new Set((req.body.marks || []).map((m) => m.student_id)),
      ]
      for (const studentId of studentIds) {
        if (studentId) await checkAndAwardBadges(studentId)
      }
    }
    res.json({ message: "Bulk marks updated successfully" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Update a mark (teacher only)
app.put("/api/marks/:id", requireLogin, async (req, res) => {
  try {
    const mark = await Mark.findById(req.params.id).populate("examId")
    if (!mark) return res.status(404).json({ error: "Mark not found" })

    if (mark.examId && mark.examId.status !== "completed") {
      return res
        .status(400)
        .json({ error: "Marks can only be updated after exam completion." })
    }

    const marksObtained = Number(req.body.marks_obtained)
    const maxMarks = mark.examId
      ? mark.examId.totalMarks
      : req.body.max_marks || mark.maxMarks

    if (marksObtained < 0)
      return res.status(400).json({ error: "Marks cannot be negative" })
    if (mark.examId && marksObtained > mark.examId.totalMarks) {
      return res
        .status(400)
        .json({
          error: `Marks cannot exceed exam total marks (${mark.examId.totalMarks})`,
        })
    }

    await Mark.findByIdAndUpdate(req.params.id, { marksObtained, maxMarks })
    await checkAndAwardBadges(mark.studentId)
    res.json({ message: "Mark updated" })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Delete a mark
app.delete("/api/marks/:id", requireLogin, async (req, res) => {
  await Mark.findByIdAndDelete(req.params.id)
  res.json({ message: "Mark deleted" })
})

// Delete attendance record
app.delete("/api/attendance/:id", requireLogin, async (req, res) => {
  await Attendance.findByIdAndDelete(req.params.id)
  res.json({ message: "Attendance record deleted" })
})

// ─── ANALYTICS ROUTES ────────────────────────────────────────
app.get("/api/analytics/classes", requireLogin, async (req, res) => {
  let filter = {}
  if (req.session.role === "teacher") {
    const teacherClassIds = await getTeacherClasses(req.session.userId)
    filter = { _id: { $in: teacherClassIds } }
  }
  const classes = await Class.find(filter)
  const result = []
  for (const c of classes) {
    const count = await Student.countDocuments({ classId: c._id })
    result.push({
      id: c._id.toString(),
      name: c.name,
      student_count: count,
      teacher_ids: c.teacherIds.map((t) => t.toString()),
    })
  }
  res.json({ classes: result })
})

app.get("/api/analytics/subjects", requireLogin, async (req, res) => {
  let filter =
    req.query.class_id && req.query.class_id !== "all"
      ? { classId: req.query.class_id }
      : {}

  if (req.session.role === "teacher") {
    const teacherClassIds = await getTeacherClasses(req.session.userId)
    if (req.query.class_id && req.query.class_id !== "all") {
      if (
        !teacherClassIds.map((id) => id.toString()).includes(req.query.class_id)
      ) {
        return res.json({ subjects: [] })
      }
    } else {
      filter = { classId: { $in: teacherClassIds } }
    }
  }

  const subjects = await Subject.find(filter)
  res.json({
    subjects: subjects.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      code: s.code,
    })),
  })
})

app.get("/api/analytics/overview", requireLogin, async (req, res) => {
  try {
    const { class_id, exam_id } = req.query
    let studentFilter = {}
    let classFilter = {}
    let markFilter = {}

    if (req.session.role === "teacher") {
      const teacherClassIds = await getTeacherClasses(req.session.userId)
      studentFilter.classId = { $in: teacherClassIds }
      classFilter._id = { $in: teacherClassIds }
    }

    if (class_id && class_id !== "all") {
      studentFilter.classId = class_id
      classFilter._id = class_id
    }

    const students = await Student.find(studentFilter)
    const studentIds = students.map((s) => s._id)

    markFilter.studentId = { $in: studentIds }
    if (exam_id && exam_id !== "all") {
      markFilter.examId = exam_id
    }

    const allMarks = await Mark.find(markFilter).populate("subjectId")
    const allStudentsWithClass =
      await Student.find(studentFilter).populate("classId")

    const total_students = students.length
    const total_classes = await Class.countDocuments(classFilter)

    const isStudent = req.session.role === "student"
    const filteredMarks = await filterRealMarks(allMarks, isStudent)

    // Overall average
    let avg = 0
    if (filteredMarks.length) {
      avg = Math.round(
        filteredMarks.reduce(
          (s, m) => s + (m.marksObtained / m.maxMarks) * 100,
          0,
        ) / filteredMarks.length,
      )
    }

    // Subject performance
    const subjectMap = {}
    filteredMarks.forEach((m) => {
      const name = m.subjectId?.name || "Unknown"
      if (!subjectMap[name]) subjectMap[name] = []
      subjectMap[name].push((m.marksObtained / m.maxMarks) * 100)
    })
    const subject_performance = Object.entries(subjectMap)
      .map(([name, vals]) => ({
        subject_name: name,
        avg_percentage: Math.round(
          vals.reduce((a, b) => a + b, 0) / vals.length,
        ),
      }))
      .sort((a, b) => b.avg_percentage - a.avg_percentage)

    // Class performance
    const classMap = {}
    for (const s of allStudentsWithClass) {
      const cn = s.classId?.name || "Unknown"
      const sMarks = filteredMarks.filter(
        (m) => m.studentId.toString() === s._id.toString(),
      )
      if (sMarks.length) {
        if (!classMap[cn]) classMap[cn] = []
        const a =
          sMarks.reduce(
            (sum, m) => sum + (m.marksObtained / m.maxMarks) * 100,
            0,
          ) / sMarks.length
        classMap[cn].push(a)
      }
    }
    const class_performance = Object.entries(classMap)
      .map(([name, avgs]) => ({
        class_name: name,
        avg_percentage: Math.round(
          avgs.reduce((s, a) => s + a, 0) / avgs.length,
        ),
      }))
      .sort((a, b) => b.avg_percentage - a.avg_percentage)

    // Top students
    const studentAvgs = []
    for (const s of students) {
      const sMarks = filteredMarks.filter(
        (m) => m.studentId.toString() === s._id.toString(),
      )
      if (sMarks.length) {
        const a = Math.round(
          sMarks.reduce(
            (sum, m) => sum + (m.marksObtained / m.maxMarks) * 100,
            0,
          ) / sMarks.length,
        )
        studentAvgs.push({
          id: s._id.toString(),
          name: s.name,
          avg_percentage: a,
        })
      }
    }
    const top_students = [...studentAvgs]
      .sort((a, b) => b.avg_percentage - a.avg_percentage)
      .slice(0, 5)

    res.json({
      total_students,
      total_classes,
      average_percentage: avg,
      subject_performance,
      class_performance,
      top_students,
      student_performance: studentAvgs.sort(
        (a, b) => b.avg_percentage - a.avg_percentage,
      ),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/analytics/class/:id", requireLogin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ error: "Invalid ID format" })
    const cls = await Class.findById(req.params.id)
    if (!cls) return res.status(404).json({ error: "Class not found" })

    if (req.session.role === "teacher") {
      const teacherClassIds = await getTeacherClasses(req.session.userId)
      if (!teacherClassIds.map((id) => id.toString()).includes(req.params.id)) {
        return res
          .status(403)
          .json({ error: "Access denied: You are not assigned to this class" })
      }
    }

    const { exam_id } = req.query
    const students = await Student.find({ classId: cls._id })

    let markFilter = { studentId: { $in: students.map((s) => s._id) } }
    if (exam_id && exam_id !== "all") {
      markFilter.examId = exam_id
    }

    const isStudent = req.session.role === "student"
    const allMarks = await Mark.find(markFilter).populate("subjectId examId")
    const filteredMarks = await filterRealMarks(allMarks, isStudent)
    const subjects = await Subject.find({ classId: cls._id })

    const studentData = []
    for (const s of students) {
      const sMarks = filteredMarks.filter(
        (m) => m.studentId.toString() === s._id.toString(),
      )
      const avg = sMarks.length
        ? Math.round(
            sMarks.reduce(
              (sum, m) => sum + (m.marksObtained / m.maxMarks) * 100,
              0,
            ) / sMarks.length,
          )
        : 0
      studentData.push({
        id: s._id.toString(),
        name: s.name,
        enrollment_no: s.enrollmentNo,
        avg_percentage: avg,
      })
    }
    studentData.sort((a, b) => b.avg_percentage - a.avg_percentage)

    // Subject avgs
    const subjectData = subjects
      .map((sub) => {
        const sMarks = filteredMarks.filter(
          (m) => m.subjectId?._id.toString() === sub._id.toString(),
        )
        const avg = sMarks.length
          ? Math.round(
              sMarks.reduce(
                (s, m) => s + (m.marksObtained / m.maxMarks) * 100,
                0,
              ) / sMarks.length,
            )
          : 0
        return { name: sub.name, avg_percentage: avg }
      })
      .sort((a, b) => b.avg_percentage - a.avg_percentage)

    // Grade distribution
    const allPcts = filteredMarks.map(
      (m) => (m.marksObtained / m.maxMarks) * 100,
    )
    const grade_distribution = {
      grade_A: allPcts.filter((p) => p >= 90).length,
      grade_B: allPcts.filter((p) => p >= 75 && p < 90).length,
      grade_C: allPcts.filter((p) => p >= 60 && p < 75).length,
      grade_D: allPcts.filter((p) => p >= 40 && p < 60).length,
      grade_F: allPcts.filter((p) => p < 40).length,
    }

    res.json({
      students: studentData,
      subjects: subjectData,
      grade_distribution,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/analytics/student/:id", requireLogin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ error: "Invalid ID format" })
    const student = await Student.findById(req.params.id).populate("classId")
    if (!student) return res.status(404).json({ error: "Student not found" })

    if (req.session.role === "teacher") {
      const teacherClassIds = await getTeacherClasses(req.session.userId)
      if (
        !teacherClassIds
          .map((id) => id.toString())
          .includes(student.classId._id.toString())
      ) {
        return res
          .status(403)
          .json({
            error: "Access denied: This student is not in your assigned class",
          })
      }
    }
    const examId = req.query.exam_id
    let markFilter = { studentId: student._id }
    if (examId && examId !== "all") markFilter.examId = examId

    const isStudent = req.session.role === "student"
    const marks = await Mark.find(markFilter).populate("subjectId examId")
    const filteredMarks = await filterRealMarks(marks, isStudent)
    const allClassStudents = await Student.find({
      classId: student.classId._id,
    })

    // Overall avg for context
    const avgMarks = filteredMarks.length
      ? Math.round(
          filteredMarks.reduce(
            (s, m) => s + (m.marksObtained / m.maxMarks) * 100,
            0,
          ) / filteredMarks.length,
        )
      : 0

    // Rank for this specific context (Exam or Overall)
    const avgs = []
    for (const cs of allClassStudents) {
      let csFilter = { studentId: cs._id }
      if (examId && examId !== "all") csFilter.examId = examId

      const csMarks = await Mark.find(csFilter)
      const filteredCSMarks = await filterRealMarks(csMarks, isStudent)
      const a = filteredCSMarks.length
        ? filteredCSMarks.reduce(
            (s, m) => s + (m.marksObtained / m.maxMarks) * 100,
            0,
          ) / filteredCSMarks.length
        : 0
      avgs.push({ id: cs._id.toString(), avg: a })
    }
    avgs.sort((a, b) => b.avg - a.avg)
    const rank = avgs.findIndex((a) => a.id === student._id.toString()) + 1

    // Subject marks
    const subjMap = {}
    filteredMarks.forEach((m) => {
      const name = m.subjectId?.name || ""
      if (name) {
        if (!subjMap[name])
          subjMap[name] = { totalObtained: 0, totalMax: 0, count: 0 }
        subjMap[name].totalObtained += m.marksObtained
        subjMap[name].totalMax += m.maxMarks
        subjMap[name].count += 1
      }
    })

    const subject_marks = Object.keys(subjMap).map((name) => {
      const sm = subjMap[name]
      return {
        subject_name: name,
        percentage: Math.round((sm.totalObtained / sm.totalMax) * 100),
      }
    })

    const detailed_marks = filteredMarks.map((m) => ({
      id: m._id,
      subject_id: m.subjectId?._id,
      subject_name: m.subjectId?.name || "Unknown",
      exam_id: m.examId?._id,
      exam_name: m.examId?.name || "No Exam",
      marks_obtained: m.marksObtained,
      max_marks: m.maxMarks,
      percentage: Math.round((m.marksObtained / m.maxMarks) * 100),
    }))

    res.json({
      student: {
        name: student.name,
        class_name: student.classId.name,
        enrollment_no: student.enrollmentNo,
        user_id:
          req.session.role === "admin"
            ? (await User.findOne({ studentId: student._id }))?._id
            : null,
        class_id: student.classId._id,
        alias: student.alias || "",
        useAlias: student.useAlias || false,
        badges: student.badges || [],
      },
      overall_average: avgMarks,
      rank,
      total_in_class: allClassStudents.length,
      subject_marks,
      marks: detailed_marks,
      rank_context: examId && examId !== "all" ? "Exam Rank" : "Overall Rank",
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── AI HELPERS (inlined from ai.js) ─────────────────────────

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
      tips: ["Revise fundamentals", "Practice past papers", "Seek teacher help"],
    }))
  }

  const generalAdvice = []
  if (isCriticalZero) {
    generalAdvice.push("CRITICAL ALERT: Your marks are at zero.")
    generalAdvice.push("Contact your teacher or school administration immediately.")
    generalAdvice.push("You are at serious risk of failing — do not delay.")
  } else if (isNewStudent) {
    generalAdvice.push("Welcome! No marks recorded yet — your journey starts here.")
    generalAdvice.push("Focus on understanding the basics of each subject.")
    generalAdvice.push("Make sure your marks are entered after each test or exam.")
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

async function analyzeStudent(studentData) {
  return generateFallbackAnalysis(studentData)
}

async function analyzeAtRisk(studentsData) {
  return generateFallbackAtRisk(studentsData)
}

async function chatAssistant(message, dataStr, role) {
  if (role === "teacher") {
    const nameMatch = message.match(/([A-Z][a-z]+)\b/)
    const studentName = nameMatch ? nameMatch[1] : null
    if (studentName) {
      return `Based on the available data for ${studentName}, review their subject-wise marks and prioritize the lowest scoring subject for targeted support.`
    }
    return "Please specify a student's name for recommendations (e.g., 'Aarav')."
  }
  return "AI chatbot has been disabled by the administrator."
}

// ─── AI ROUTES ───────────────────────────────────────────────

app.get("/api/ai/predict/:id", requireLogin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ error: "Invalid ID format" })
    const student = await Student.findById(req.params.id).populate("classId")
    if (!student) return res.status(404).json({ error: "Student not found" })

    if (req.session.role === "teacher") {
      const teacherClassIds = await getTeacherClasses(req.session.userId)
      if (
        !teacherClassIds
          .map((id) => id.toString())
          .includes(student.classId._id.toString())
      ) {
        return res.status(403).json({ error: "Access denied" })
      }
    }
    const marks = await Mark.find({ studentId: student._id }).populate(
      "subjectId",
    )
    const subjMap = {}
    marks.forEach((m) => {
      const n = m.subjectId?.name || "Unknown"
      if (!subjMap[n]) subjMap[n] = []
      subjMap[n].push((m.marksObtained / m.maxMarks) * 100)
    })
    const subjectAverages = Object.entries(subjMap).map(([name, vals]) => ({
      name,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }))

    // If no marks yet, fetch class subjects so fallback can still give recommendations
    let effectiveSubjectAverages = subjectAverages
    if (!effectiveSubjectAverages.length) {
      const classSubjects = await Subject.find({ classId: student.classId._id })
      effectiveSubjectAverages = classSubjects.map((s) => ({
        name: s.name,
        avg: 0,
      }))
    }

    const data = {
      name: student.name,
      className: student.classId?.name || "",
      enrollmentNo: student.enrollmentNo,
      marks: marks.map((m) => ({
        subjectName: m.subjectId?.name || "",
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
      })),
      subjectAverages: effectiveSubjectAverages,
      overallAverage: effectiveSubjectAverages.length
        ? Math.round(
            effectiveSubjectAverages.reduce((s, a) => s + a.avg, 0) /
              effectiveSubjectAverages.length,
          )
        : 0,
    }

    const result = await analyzeStudent(data)
    // Normalize to snake_case for frontend
    res.json({
      predictions: (result.predictions || []).map((p) => ({
        subject_name: p.subject,
        current_average: p.currentAvg,
        predicted_percentage: p.predictedNext,
        trend: p.trend,
      })),
      risk_level: result.riskLevel,
      risk_reasons: result.riskReasons || [],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/ai/recommendations/:id", requireLogin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ error: "Invalid ID format" })
    const student = await Student.findById(req.params.id).populate("classId")
    if (!student) return res.status(404).json({ error: "Student not found" })

    if (req.session.role === "teacher") {
      const teacherClassIds = await getTeacherClasses(req.session.userId)
      if (
        !teacherClassIds
          .map((id) => id.toString())
          .includes(student.classId._id.toString())
      ) {
        return res.status(403).json({ error: "Access denied" })
      }
    }
    const marks = await Mark.find({ studentId: student._id }).populate(
      "subjectId",
    )
    const subjMap = {}
    marks.forEach((m) => {
      const n = m.subjectId?.name || "Unknown"
      if (!subjMap[n]) subjMap[n] = []
      subjMap[n].push((m.marksObtained / m.maxMarks) * 100)
    })
    const subjectAverages = Object.entries(subjMap).map(([name, vals]) => ({
      name,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }))

    // If no marks yet, fetch class subjects so fallback can still give recommendations
    let effectiveSubjectAverages2 = subjectAverages
    if (!effectiveSubjectAverages2.length) {
      const classSubjects2 = await Subject.find({
        classId: student.classId._id,
      })
      effectiveSubjectAverages2 = classSubjects2.map((s) => ({
        name: s.name,
        avg: 0,
      }))
    }

    const data = {
      name: student.name,
      className: student.classId?.name || "",
      enrollmentNo: student.enrollmentNo,
      marks: marks.map((m) => ({
        subjectName: m.subjectId?.name || "",
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
      })),
      subjectAverages: effectiveSubjectAverages2,
      overallAverage: effectiveSubjectAverages2.length
        ? Math.round(
            effectiveSubjectAverages2.reduce((s, a) => s + a.avg, 0) /
              effectiveSubjectAverages2.length,
          )
        : 0,
    }
    const result = await analyzeStudent(data)
    res.json({
      recommendations: result.recommendations || [],
      general_advice: result.generalAdvice || [],
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/ai/at-risk", requireLogin, async (req, res) => {
  try {
    let filter = {}
    const { class_id } = req.query

    if (req.session.role === "teacher") {
      const teacherClassIds = await getTeacherClasses(req.session.userId)
      if (class_id && class_id !== "all") {
        if (!teacherClassIds.map((id) => id.toString()).includes(class_id)) {
          return res.json({ at_risk_students: [] })
        }
        filter.classId = class_id
      } else {
        filter = { classId: { $in: teacherClassIds } }
      }
    } else if (class_id && class_id !== "all") {
      filter.classId = class_id
    }
    const students = await Student.find(filter).populate("classId")
    if (!students.length) return res.json({ at_risk_students: [] })

    const studentIds = students.map((s) => s._id)
    const allMarks = await Mark.find({
      studentId: { $in: studentIds },
    }).populate("subjectId")

    const marksByStudent = {}
    allMarks.forEach((m) => {
      const sid = m.studentId.toString()
      if (!marksByStudent[sid]) marksByStudent[sid] = []
      marksByStudent[sid].push(m)
    })

    const studentsData = students.map((s) => {
      const marks = marksByStudent[s._id.toString()] || []
      const subjectMarks = marks.map((m) => ({
        subjectName: m.subjectId?.name || "Unknown",
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        percentage: Math.round((m.marksObtained / m.maxMarks) * 100),
      }))
      const overallAverage = subjectMarks.length
        ? Math.round(
            subjectMarks.reduce((acc, m) => acc + m.percentage, 0) /
              subjectMarks.length,
          )
        : 0

      return {
        name: s.name,
        className: s.classId?.name || "",
        overallAverage,
        subjectMarks,
      }
    })

    const result = await analyzeAtRisk(studentsData)
    // Normalize to snake_case for frontend
    res.json({
      at_risk_students: (result.atRiskStudents || []).map((s) => ({
        name: s.name,
        class_name: s.className || s.class_name || "",
        risk_level: s.riskLevel || s.risk_level,
        reasons: s.reasons || [],
        subjects: s.subjects || [],
        average_percentage: s.avgPercentage || s.average_percentage || 0,
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/ai/chat", requireLogin, async (req, res) => {
  try {
    const { message } = req.body
    if (!message) return res.status(400).json({ error: "Message required" })

    const role = req.session.role
    let dataStr = ""

    if (role === "student") {
      const user = await User.findById(req.session.userId)
      if (!user.studentId)
        return res.status(400).json({ error: "No student profile linked." })
      const student = await Student.findById(user.studentId)
      const marks = await Mark.find({ studentId: student._id }).populate(
        "subjectId",
      )
      dataStr =
        `Student Name: ${student.name}. Marks: ` +
        marks
          .map((m) => `${m.subjectId?.name}:${m.marksObtained}/${m.maxMarks}`)
          .join(", ")
    } else if (role === "admin") {
      dataStr = "You are the Admin. You have access to all system data."
    } else {
      const students = await Student.find()
      const marks = await Mark.find().populate("subjectId")
      dataStr =
        "System Students Data:\n" +
        students
          .map((s) => {
            const sMarks = marks.filter(
              (m) => m.studentId.toString() === s._id.toString(),
            )
            return `${s.name} - Marks: ${sMarks.map((m) => `${m.subjectId?.name}:${m.marksObtained}`).join(", ")}`
          })
          .join("\n")
    }

    const reply = await chatAssistant(message, dataStr, role)
    res.json({ reply })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/admin/reset-password", requireAdmin, async (req, res) => {
  try {
    const { userId, newPassword } = req.body
    if (!newPassword || newPassword.length < 4) {
      return res
        .status(400)
        .json({ error: "Password must be at least 4 characters" })
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await User.findByIdAndUpdate(userId, { password: hashedPassword })
    res.json({ message: "Password reset successfully" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/admin/toggle-block", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ error: "User not found" })
    if (user.role === "admin")
      return res.status(403).json({ error: "Cannot block administrator" })

    user.isBlocked = !user.isBlocked
    await user.save()
    res.json({
      message: user.isBlocked ? "User blocked" : "User unblocked",
      is_blocked: user.isBlocked,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── TEACHER MANAGEMENT (Admin Only) ─────────────────────────
app.get("/api/teachers", requireAdmin, async (req, res) => {
  const teachers = await User.find({ role: "teacher" })
  res.json({
    teachers: teachers.map((t) => ({
      id: t._id.toString(),
      username: t.username,
    })),
  })
})

app.post("/api/teachers", requireAdmin, async (req, res) => {
  try {
    const { username, password } = req.body
    const hashedPassword = await bcrypt.hash(password, 10)
    await User.create({ username, password: hashedPassword, role: "teacher" })
    res.json({ message: "Teacher created successfully" })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.delete("/api/teachers/:id", requireAdmin, async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: "teacher" })
    if (!teacher) return res.status(404).json({ error: "Teacher not found" })
    // Remove teacher from any classes they are assigned to
    await Class.updateMany(
      { teacherIds: req.params.id },
      { $pull: { teacherIds: req.params.id } },
    )
    await User.findByIdAndDelete(req.params.id)
    res.json({ message: "Teacher deleted" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── CLASS MANAGEMENT (Admin Only) ───────────────────────────
app.post("/api/classes", requireAdmin, async (req, res) => {
  try {
    const c = await Class.create({ name: req.body.name })
    res.json(c)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.put("/api/classes/:id", requireAdmin, async (req, res) => {
  try {
    const { teacherIds } = req.body
    const c = await Class.findByIdAndUpdate(
      req.params.id,
      { teacherIds },
      { new: true },
    )
    res.json(c)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.delete("/api/classes/:id", requireAdmin, async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
    if (!cls) return res.status(404).json({ error: "Class not found" })
    await Class.findByIdAndDelete(req.params.id)
    res.json({ message: "Class deleted" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── SUBJECT MANAGEMENT (Admin Only) ─────────────────────────
app.get("/api/subjects/all", requireAdmin, async (req, res) => {
  try {
    const subjects = await Subject.find().populate("classId")
    res.json({
      subjects: subjects.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        code: s.code,
        class_id: s.classId?._id?.toString(),
        class_name: s.classId?.name || "Unassigned",
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/subjects", requireAdmin, async (req, res) => {
  try {
    const { name, code, class_id } = req.body
    if (!name || !code || !class_id)
      return res
        .status(400)
        .json({ error: "Name, code, and class_id are required" })

    const s = await Subject.create({ name, code, classId: class_id })

    // Auto-seed 0 marks for all students in this class for the new subject
    const students = await Student.find({ classId: class_id })
    const markInserts = students.map((student) => ({
      studentId: student._id,
      subjectId: s._id,
      marksObtained: 0,
      maxMarks: 100,
    }))
    if (markInserts.length) await Mark.insertMany(markInserts)

    res.json({ id: s._id, message: "Subject created and marks seeded" })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.delete("/api/subjects/:id", requireAdmin, async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id)
    await Mark.deleteMany({ subjectId: req.params.id })
    res.json({ message: "Subject deleted" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── EXAM MANAGEMENT (Admin Only) ───────────────────────────
app.get("/api/exams", requireLogin, async (req, res) => {
  try {
    let filter = {}
    if (req.query.class_id && req.query.class_id !== "all")
      filter.classId = req.query.class_id

    const exams = await Exam.find(filter).populate("classId")
    res.json({
      exams: exams.map((e) => ({
        id: e._id.toString(),
        name: e.name,
        date: e.date,
        description: e.description || "",
        class_id: e.classId?._id?.toString() || e.classId?.toString(),
        class_name: e.classId?.name || "Unknown",
        total_marks: e.totalMarks || 100,
        status: e.status || "scheduled",
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/exams", requireAdmin, async (req, res) => {
  try {
    const { name, date, class_id, description, total_marks } = req.body
    const totalMarks = Number(total_marks) || 100
    const e = await Exam.create({
      name,
      date,
      classId: class_id,
      description: description || "",
      totalMarks,
      status: "scheduled",
    })

    const [students, subjects] = await Promise.all([
      Student.find({ classId: class_id }),
      Subject.find({ classId: class_id }),
    ])

    if (students.length && subjects.length) {
      const bulkMarks = []
      students.forEach((s) => {
        subjects.forEach((sub) => {
          bulkMarks.push({
            studentId: s._id,
            subjectId: sub._id,
            examId: e._id,
            marksObtained: 0,
            maxMarks: totalMarks,
          })
        })
      })
      await Mark.insertMany(bulkMarks)
    }

    // Auto-create notification for scheduled exam targeted to the students in the class
    try {
      const dateObj = new Date(date)
      const formattedDate = dateObj.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      const formattedTime = dateObj.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      const formattedDateTime = `${formattedDate} at ${formattedTime}`

      const adminUser = await User.findById(req.session.userId)
      const senderName = adminUser ? adminUser.username : "Administrator"

      if (students && students.length > 0) {
        const notifPromises = students.map((student) => {
          const studentName = student.name
          const message = `Hello ${studentName}, your exam ${name} has been scheduled on ${formattedDateTime}.\nThe topics are: ${description || "all general class topics"}\nWishing you the absolute best of luck!`
          return Notification.create({
            message,
            senderRole: "admin",
            senderName,
            targetType: "student",
            targetStudentId: student._id,
          })
        })
        await Promise.all(notifPromises)
      } else {
        // Fallback class notification if no students are enrolled yet
        const classObj = await Class.findById(class_id)
        const className = classObj ? classObj.name : "your class"
        const message = `Hello Students, your exam ${name} has been scheduled on ${formattedDateTime}.\nThe topics are: ${description || "all general class topics"}\nWishing you the absolute best of luck!`
        await Notification.create({
          message,
          senderRole: "admin",
          senderName,
          targetType: "class",
          targetClassId: class_id,
        })
      }
    } catch (notifErr) {
      console.error("Failed to create automatic exam notification:", notifErr)
    }

    res.json({ id: e._id.toString(), message: "Exam created successfully" })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Update Exam Status
app.patch("/api/exams/:id/status", requireLogin, async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ["scheduled", "ongoing", "completed"]
    if (!allowed.includes(status))
      return res.status(400).json({ error: "Invalid status" })

    // Block status changes if results have been published
    const config = await ExamConfig.findOne({ examId: req.params.id })
    if (config && config.resultsVisible) {
      return res
        .status(400)
        .json({
          error: "Cannot change status once results have been published.",
        })
    }

    const e = await Exam.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    )
    if (!e) return res.status(404).json({ error: "Exam not found" })

    res.json({ message: `Exam status updated to ${status}`, status: e.status })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete("/api/exams/:id", requireAdmin, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
    if (!exam) return res.status(404).json({ error: "Exam not found" })

    // Cascade: delete marks, config, attempts and notifications related to this exam
    await Promise.all([
      Exam.findByIdAndDelete(req.params.id),
      Mark.deleteMany({ examId: req.params.id }),
      ExamConfig.deleteMany({ examId: req.params.id }),
      ExamAttempt.deleteMany({ examId: req.params.id }),
    ])
    res.json({ message: "Exam and all related data deleted" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ═══════════════════════════════════════════════════════════
// ─── EXAM PORTAL ROUTES ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

// ── Exam Config (Admin) ──────────────────────────────────────
// GET config for a single exam
app.get("/api/exam-portal/config/:examId", requireLogin, async (req, res) => {
  try {
    const config = await ExamConfig.findOne({
      examId: req.params.examId,
    }).populate("subjects.subjectId")
    res.json({
      config: config
        ? {
            id: config._id.toString(),
            exam_id: config.examId.toString(),
            subjects: config.subjects.map((s) => ({
              subject_id: s.subjectId?._id?.toString(),
              subject_name: s.subjectId?.name,
              total_marks: s.totalMarks,
              total_questions: s.totalQuestions,
              marks_per_question: s.marksPerQuestion,
            })),
            duration_minutes: config.durationMinutes,
            is_active: config.isActive,
            results_visible: config.resultsVisible,
            starts_at: config.startsAt,
            login_window_minutes: config.loginWindowMinutes,
            strict_forward_only: config.strictForwardOnly,
            time_per_question_seconds: config.timePerQuestionSeconds,
          }
        : null,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Create or update exam config
app.post("/api/exam-portal/config", requireAdmin, async (req, res) => {
  try {
    const {
      exam_id,
      subjects,
      duration_minutes,
      starts_at,
      login_window_minutes,
      strict_forward_only,
      time_per_question_seconds,
      negative_marks,
    } = req.body
    if (
      !exam_id ||
      !subjects ||
      !Array.isArray(subjects) ||
      subjects.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "exam_id and subjects array required" })
    }

    const exam = await Exam.findById(exam_id)
    if (!exam) {
      return res.status(404).json({ error: "Exam not found" })
    }

    const oldConfig = await ExamConfig.findOne({ examId: exam_id })
    if (oldConfig && oldConfig.resultsVisible) {
      return res
        .status(400)
        .json({
          error:
            "Cannot modify exam configuration once results have been published.",
        })
    }

    let isRescheduled = false

    if (starts_at) {
      const startsAtDate = new Date(starts_at)
      if (
        oldConfig &&
        oldConfig.startsAt &&
        new Date(oldConfig.startsAt).getTime() !== startsAtDate.getTime()
      ) {
        isRescheduled = true
      }

      // Update parent Exam date and reset status if it was completed
      let newStatus = exam.status
      if (exam.status === "completed") {
        newStatus = "scheduled"
      }
      await Exam.findByIdAndUpdate(exam_id, {
        date: startsAtDate,
        status: newStatus,
      })

      // Send notification to students who have NOT attempted the exam
      if (isRescheduled) {
        try {
          const [allStudents, attempts] = await Promise.all([
            Student.find({ classId: exam.classId }),
            ExamAttempt.find({ examId: exam_id }),
          ])

          const attemptedStudentIds = new Set(
            attempts.map((a) => a.studentId.toString()),
          )
          const missedStudents = allStudents.filter(
            (s) => !attemptedStudentIds.has(s._id.toString()),
          )

          if (missedStudents.length > 0) {
            const dateObj = new Date(starts_at)
            const formattedDate = dateObj.toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
            const formattedTime = dateObj.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })
            const formattedDateTime = `${formattedDate} at ${formattedTime}`

            const adminUser = await User.findById(req.session.userId)
            const senderName = adminUser ? adminUser.username : "Administrator"

            const notifPromises = missedStudents.map((student) => {
              const message = `Hello ${student.name}, the exam "${exam.name}" has been rescheduled to ${formattedDateTime} for students who have not attempted it yet. Please make sure to log in on time to attempt your exam.`
              return Notification.create({
                message,
                senderRole: "admin",
                senderName,
                targetType: "student",
                targetStudentId: student._id,
              })
            })
            await Promise.all(notifPromises)
          }
        } catch (notifErr) {
          console.error("Failed to send rescheduled notifications:", notifErr)
        }
      }
    }

    const formattedSubjects = subjects.map((s) => {
      const tm = Number(s.total_marks)
      const tq = Number(s.total_questions)
      if (!tm || !tq)
        throw new Error(
          "total_marks and total_questions required for each subject",
        )
      return {
        subjectId: s.subject_id,
        totalMarks: tm,
        totalQuestions: tq,
        marksPerQuestion: tm / tq,
      }
    })

    // Check if there are attempts for this exam
    const attemptsCount = await ExamAttempt.countDocuments({ examId: exam_id })
    if (attemptsCount > 0 && oldConfig) {
      if (
        duration_minutes !== undefined &&
        Number(duration_minutes) !== oldConfig.durationMinutes
      ) {
        return res
          .status(400)
          .json({
            error:
              "Cannot modify exam duration once the exam has been attempted.",
          })
      }
      if (
        strict_forward_only !== undefined &&
        Boolean(strict_forward_only) !== oldConfig.strictForwardOnly
      ) {
        return res
          .status(400)
          .json({
            error:
              "Cannot modify strict forward settings once the exam has been attempted.",
          })
      }
      if (
        time_per_question_seconds !== undefined &&
        Number(time_per_question_seconds) !== oldConfig.timePerQuestionSeconds
      ) {
        return res
          .status(400)
          .json({
            error:
              "Cannot modify question timer once the exam has been attempted.",
          })
      }
      if (
        negative_marks !== undefined &&
        Number(negative_marks) !== oldConfig.negativeMarks
      ) {
        return res
          .status(400)
          .json({
            error:
              "Cannot modify negative marks once the exam has been attempted.",
          })
      }
      const oldSubjects = oldConfig.subjects || []
      if (formattedSubjects.length !== oldSubjects.length) {
        return res
          .status(400)
          .json({
            error: "Cannot modify subjects once the exam has been attempted.",
          })
      }
      for (const fSub of formattedSubjects) {
        const oSub = oldSubjects.find(
          (s) => s.subjectId.toString() === fSub.subjectId.toString(),
        )
        if (
          !oSub ||
          oSub.totalMarks !== fSub.totalMarks ||
          oSub.totalQuestions !== fSub.totalQuestions
        ) {
          return res
            .status(400)
            .json({
              error:
                "Cannot modify subject marks or questions once the exam has been attempted.",
            })
        }
      }
    }

    const config = await ExamConfig.findOneAndUpdate(
      { examId: exam_id },
      {
        subjects: formattedSubjects,
        durationMinutes: duration_minutes || 60,
        startsAt: starts_at ? new Date(starts_at) : null,
        loginWindowMinutes: login_window_minutes || 15,
        strictForwardOnly: strict_forward_only || false,
        timePerQuestionSeconds: time_per_question_seconds || 0,
        negativeMarks: negative_marks || 0,
      },
      { upsert: true, new: true },
    )

    // Align Mark records with the newly configured subjects
    try {
      const configuredSubjectIds = formattedSubjects.map((s) =>
        s.subjectId.toString(),
      )

      // Delete mark records for subjects not in the config for this exam
      await Mark.deleteMany({
        examId: exam_id,
        subjectId: { $nin: configuredSubjectIds },
      })

      // Seed/ensure mark records exist only for the configured subjects
      const students = await Student.find({ classId: exam.classId })
      if (students.length > 0) {
        const markPromises = []
        for (const s of students) {
          for (const sub of formattedSubjects) {
            markPromises.push(
              Mark.findOneAndUpdate(
                { studentId: s._id, subjectId: sub.subjectId, examId: exam_id },
                {
                  $set: { maxMarks: sub.totalMarks },
                  $setOnInsert: { marksObtained: 0 },
                },
                { upsert: true },
              ),
            )
          }
        }
        await Promise.all(markPromises)
      }
    } catch (markErr) {
      console.error("Failed to align student marks with config:", markErr)
    }

    res.json({
      id: config._id.toString(),
      message: "Exam configured successfully",
    })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Toggle exam active/inactive
app.post(
  "/api/exam-portal/config/:examId/toggle",
  requireAdmin,
  async (req, res) => {
    try {
      const config = await ExamConfig.findOne({
        examId: req.params.examId,
      }).populate("subjects.subjectId")
      if (!config)
        return res.status(404).json({ error: "Exam not configured yet" })

      if (config.resultsVisible) {
        return res
          .status(400)
          .json({
            error:
              "Cannot toggle active status once results have been published.",
          })
      }

      if (!config.isActive) {
        // Before activating, check if all questions are uploaded
        const questions = await Question.find({ examId: req.params.examId })
        for (const sub of config.subjects) {
          const subQuestions = questions.filter(
            (q) => q.subjectId.toString() === sub.subjectId._id.toString(),
          )
          if (subQuestions.length !== sub.totalQuestions) {
            return res
              .status(400)
              .json({
                error: `Cannot activate: Subject ${sub.subjectId.name} requires ${sub.totalQuestions} questions, but has ${subQuestions.length}.`,
              })
          }
        }
      }

      config.isActive = !config.isActive
      await config.save()
      res.json({
        is_active: config.isActive,
        message: config.isActive ? "Exam is now OPEN" : "Exam is now CLOSED",
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  },
)

// Toggle result visibility (admin publishes/hides results for students)
app.post(
  "/api/exam-portal/config/:examId/toggle-results",
  requireAdmin,
  async (req, res) => {
    try {
      const config = await ExamConfig.findOne({ examId: req.params.examId })
      if (!config)
        return res.status(404).json({ error: "Exam not configured yet" })
      config.resultsVisible = !config.resultsVisible
      await config.save()
      res.json({
        results_visible: config.resultsVisible,
        message: config.resultsVisible
          ? "Results are now VISIBLE to students"
          : "Results are now HIDDEN from students",
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  },
)

// ── Questions (Admin) ────────────────────────────────────────
// Get all questions for an exam
app.get(
  "/api/exam-portal/questions/:examId",
  requireLogin,
  async (req, res) => {
    try {
      const questions = await Question.find({ examId: req.params.examId })
        .populate("subjectId")
        .sort("order")
      const isStudent = req.session.role === "student"
      res.json({
        questions: questions.map((q) => ({
          id: q._id.toString(),
          question_text: q.questionText,
          image_url: q.imageUrl || "",
          options: q.options,
          subject_id: q.subjectId?._id,
          subject_name: q.subjectId?.name,
          order: q.order,
          // Only hide correct answer from students
          ...(isStudent
            ? {}
            : {
                correct_option:
                  q.correctOptions && q.correctOptions.length === 1
                    ? q.correctOptions[0]
                    : q.correctOption !== undefined
                      ? q.correctOption
                      : -1,
                correct_options:
                  q.correctOptions && q.correctOptions.length > 0
                    ? q.correctOptions
                    : q.correctOption !== undefined && q.correctOption !== -1
                      ? [q.correctOption]
                      : [],
              }),
        })),
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  },
)

// Create a question
app.post("/api/exam-portal/questions", requireAdmin, async (req, res) => {
  try {
    const {
      exam_id,
      subject_id,
      question_text,
      options,
      correct_option,
      correct_options,
      image_data,
    } = req.body

    if (!exam_id) {
      return res.status(400).json({ error: "exam_id is required" })
    }

    // Block adding questions if results have been published
    const config = await ExamConfig.findOne({ examId: exam_id })
    if (config && config.resultsVisible) {
      return res
        .status(400)
        .json({
          error: "Cannot add questions once results have been published.",
        })
    }

    // Block adding questions if the exam has already been conducted (has attempts)
    const attemptsCount = await ExamAttempt.countDocuments({ examId: exam_id })
    if (attemptsCount > 0) {
      return res
        .status(400)
        .json({
          error:
            "Cannot add questions to an exam that has already been conducted.",
        })
    }

    let correctOptionsArr = []
    if (Array.isArray(correct_options)) {
      correctOptionsArr = correct_options.map(Number)
    } else if (
      correct_option !== undefined &&
      correct_option !== null &&
      correct_option !== ""
    ) {
      correctOptionsArr = [Number(correct_option)]
    }

    if (
      !exam_id ||
      !subject_id ||
      (!question_text && !image_data) ||
      !options ||
      options.length !== 4 ||
      correctOptionsArr.length === 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "All fields required: exam_id, subject_id, question_text (or image), 4 options, and at least one correct option",
        })
    }
    const count = await Question.countDocuments({ examId: exam_id })
    const qObj = {
      examId: exam_id,
      subjectId: subject_id,
      questionText: question_text || "",
      options,
      correctOption: correctOptionsArr.length === 1 ? correctOptionsArr[0] : -1,
      correctOptions: correctOptionsArr,
      order: count,
    }

    // If image data (data URL) provided, save file and set imageUrl
    if (
      image_data &&
      typeof image_data === "string" &&
      image_data.startsWith("data:")
    ) {
      try {
        const matches = image_data.match(/^data:(image\/\w+);base64,(.+)$/)
        if (matches) {
          const ext = matches[1].split("/")[1]
          const base64 = matches[2]
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
          const filepath = path.join(uploadsDir, filename)
          fs.writeFileSync(filepath, Buffer.from(base64, "base64"))
          qObj.imageUrl = `/uploads/questions/${filename}`
        }
      } catch (err) {
        console.error("Failed to save question image:", err.message)
      }
    }

    const q = await Question.create(qObj)
    res.json({ id: q._id.toString(), message: "Question added" })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Update a question
app.put("/api/exam-portal/questions/:id", requireAdmin, async (req, res) => {
  try {
    const {
      question_text,
      options,
      correct_option,
      correct_options,
      image_data,
    } = req.body

    const existingQ = await Question.findById(req.params.id)
    if (!existingQ) return res.status(404).json({ error: "Question not found" })

    // Block modifying questions if results have been published
    const config = await ExamConfig.findOne({ examId: existingQ.examId })
    if (config && config.resultsVisible) {
      return res
        .status(400)
        .json({
          error: "Cannot modify questions once results have been published.",
        })
    }

    // Block modifying questions if the exam has already been conducted (has attempts)
    const attemptsCount = await ExamAttempt.countDocuments({
      examId: existingQ.examId,
    })
    if (attemptsCount > 0) {
      return res
        .status(400)
        .json({
          error:
            "Cannot modify questions for an exam that has already been conducted.",
        })
    }

    let correctOptionsArr = []
    if (Array.isArray(correct_options)) {
      correctOptionsArr = correct_options.map(Number)
    } else if (
      correct_option !== undefined &&
      correct_option !== null &&
      correct_option !== ""
    ) {
      correctOptionsArr = [Number(correct_option)]
    }

    const hasImage = image_data || existingQ.imageUrl
    if (
      (!question_text && !hasImage) ||
      !options ||
      options.length !== 4 ||
      correctOptionsArr.length === 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "Question text or image is required, along with 4 options and at least one correct option.",
        })
    }

    const update = {
      questionText: question_text || "",
      options,
      correctOption: correctOptionsArr.length === 1 ? correctOptionsArr[0] : -1,
      correctOptions: correctOptionsArr,
    }

    if (
      image_data &&
      typeof image_data === "string" &&
      image_data.startsWith("data:")
    ) {
      try {
        const matches = image_data.match(/^data:(image\/\w+);base64,(.+)$/)
        if (matches) {
          const ext = matches[1].split("/")[1]
          const base64 = matches[2]
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
          const filepath = path.join(uploadsDir, filename)
          fs.writeFileSync(filepath, Buffer.from(base64, "base64"))
          update.imageUrl = `/uploads/questions/${filename}`
        }
      } catch (err) {
        console.error("Failed to save question image:", err.message)
      }
    }
    await Question.findByIdAndUpdate(req.params.id, update)
    res.json({ message: "Question updated" })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Delete a question
app.delete("/api/exam-portal/questions/:id", requireAdmin, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
    if (!question) return res.status(404).json({ error: "Question not found" })

    // Block deleting questions if results have been published
    const config = await ExamConfig.findOne({ examId: question.examId })
    if (config && config.resultsVisible) {
      return res
        .status(400)
        .json({
          error: "Cannot delete questions once results have been published.",
        })
    }

    // Block deleting questions if the exam has already been conducted (has attempts)
    const attemptsCount = await ExamAttempt.countDocuments({
      examId: question.examId,
    })
    if (attemptsCount > 0) {
      return res
        .status(400)
        .json({
          error:
            "Cannot delete questions from an exam that has already been conducted.",
        })
    }

    await Question.findByIdAndDelete(req.params.id)
    res.json({ message: "Question deleted" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Student Exam Flow ────────────────────────────────────────
// Get available exams for the logged-in student's class
app.get("/api/exam-portal/available", requireLogin, async (req, res) => {
  try {
    if (req.session.role === "student") {
      const user = await User.findById(req.session.userId)
      const student = await Student.findById(user.studentId)
      if (!student)
        return res.status(404).json({ error: "Student profile not found" })

      const exams = await Exam.find({ classId: student.classId }).populate(
        "classId",
      )
      const configs = await ExamConfig.find({
        examId: { $in: exams.map((e) => e._id) },
      }).populate("subjects.subjectId")
      const attempts = await ExamAttempt.find({ studentId: student._id })
      const configMap = Object.fromEntries(
        configs.map((c) => [c.examId.toString(), c]),
      )
      const attemptMap = Object.fromEntries(
        attempts.map((a) => [a.examId.toString(), a]),
      )

      res.json({
        exams: exams.map((e) => {
          const cfg = configMap[e._id.toString()]
          const att = attemptMap[e._id.toString()]
          const resultsVisible = cfg?.resultsVisible || false
          return {
            id: e._id.toString(),
            name: e.name,
            date: e.date,
            class_name: e.classId?.name,
            is_configured: !!cfg,
            is_active: cfg?.isActive || false,
            results_visible: resultsVisible,
            duration_minutes: cfg?.durationMinutes,
            subjects: cfg?.subjects
              ? cfg.subjects.map((s) => ({
                  subject_id: s.subjectId?._id?.toString(),
                  subject_name: s.subjectId?.name,
                  total_marks: s.totalMarks,
                  total_questions: s.totalQuestions,
                  marks_per_question: s.marksPerQuestion,
                }))
              : [],
            starts_at: cfg?.startsAt || null,
            login_window_minutes: cfg?.loginWindowMinutes || 15,
            already_attempted: !!att,
            attempt_id: att && resultsVisible ? att._id : att ? "hidden" : null,
            // Only expose score if admin has published results
            score: att && resultsVisible ? att.score : null,
            max_score: att && resultsVisible ? att.maxScore : null,
          }
        }),
      })
    } else {
      // Teacher/admin sees all exams with config status
      const { class_id } = req.query
      let filter = {}
      if (class_id && class_id !== "all") filter.classId = class_id
      else if (req.session.role === "teacher") {
        const teacherClassIds = await getTeacherClasses(req.session.userId)
        filter.classId = { $in: teacherClassIds }
      }
      const exams = await Exam.find(filter).populate("classId")
      const configs = await ExamConfig.find({
        examId: { $in: exams.map((e) => e._id) },
      }).populate("subjects.subjectId")
      const configMap = Object.fromEntries(
        configs.map((c) => [c.examId.toString(), c]),
      )
      res.json({
        exams: exams.map((e) => {
          const cfg = configMap[e._id.toString()]
          return {
            id: e._id.toString(),
            name: e.name,
            date: e.date,
            status: e.status,
            class_id: e.classId?._id?.toString(),
            class_name: e.classId?.name,
            is_configured: !!cfg,
            is_active: cfg?.isActive || false,
            results_visible: cfg?.resultsVisible || false,
            duration_minutes: cfg?.durationMinutes,
            subjects: cfg?.subjects
              ? cfg.subjects.map((s) => ({
                  subject_id: s.subjectId?._id,
                  subject_name: s.subjectId?.name,
                  total_marks: s.totalMarks,
                  total_questions: s.totalQuestions,
                  marks_per_question: s.marksPerQuestion,
                }))
              : [],
            starts_at: cfg?.startsAt || null,
            login_window_minutes: cfg?.loginWindowMinutes || 15,
            strict_forward_only: cfg?.strictForwardOnly || false,
            time_per_question_seconds: cfg?.timePerQuestionSeconds || 0,
            negative_marks: cfg?.negativeMarks || 0,
          }
        }),
      })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Start an exam — returns questions (without correct answers) for students
app.get("/api/exam-portal/start/:examId", requireLogin, async (req, res) => {
  try {
    if (req.session.role !== "student")
      return res.status(403).json({ error: "Students only" })
    const user = await User.findById(req.session.userId)
    const student = await Student.findById(user.studentId)
    if (!student)
      return res.status(404).json({ error: "Student profile not found" })

    const config = await ExamConfig.findOne({ examId: req.params.examId })
    if (!config)
      return res.status(404).json({ error: "Exam not configured yet" })
    if (!config.isActive)
      return res.status(403).json({ error: "This exam is not open yet" })

    // Enforce time window if set
    const now = new Date()
    if (config.startsAt && now < config.startsAt) {
      const opensIn = config.startsAt.toLocaleString("en-IN", {
        dateStyle: "short",
        timeStyle: "short",
      })
      return res
        .status(403)
        .json({
          error: `This exam has not started yet. It opens at ${opensIn}.`,
        })
    }

    if (config.startsAt) {
      const deadline = new Date(
        config.startsAt.getTime() + (config.loginWindowMinutes || 15) * 60000,
      )
      if (now > deadline) {
        return res
          .status(403)
          .json({ error: "The deadline to log in to this exam has passed." })
      }
    }

    // Check for existing attempt
    const existing = await ExamAttempt.findOne({
      examId: req.params.examId,
      studentId: student._id,
    })
    if (existing)
      return res
        .status(409)
        .json({
          error: "You have already submitted this exam",
          attempt: { score: existing.score, max_score: existing.maxScore },
        })

    const questions = await Question.find({ examId: req.params.examId }).sort(
      "order",
    )
    const mappedQuestions = questions.map((q) => ({
      id: q._id.toString(),
      subject_id: q.subjectId?.toString(),
      question_text: q.questionText,
      image_url: q.imageUrl || "",
      options: q.options,
      is_multiple_choice: q.correctOptions && q.correctOptions.length > 1,
    }))

    // Fisher-Yates (Knuth) Shuffle to randomize the sequence for anti-cheating
    for (let i = mappedQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[mappedQuestions[i], mappedQuestions[j]] = [
        mappedQuestions[j],
        mappedQuestions[i],
      ]
    }

    res.json({
      duration_minutes: config.durationMinutes,
      strict_forward_only: config.strictForwardOnly,
      time_per_question_seconds: config.timePerQuestionSeconds,
      negative_marks: config.negativeMarks || 0,
      subjects: config.subjects.map((s) => ({
        subject_id: s.subjectId?._id?.toString() || s.subjectId?.toString(),
        subject_name: s.subjectId?.name || "Subject",
        marks_per_question: s.marksPerQuestion,
      })),
      questions: mappedQuestions,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Submit exam answers — auto-graded, writes score to Marks table
app.post("/api/exam-portal/submit/:examId", requireLogin, async (req, res) => {
  try {
    if (req.session.role !== "student")
      return res.status(403).json({ error: "Students only" })
    const user = await User.findById(req.session.userId)
    const student = await Student.findById(user.studentId)
    if (!student)
      return res.status(404).json({ error: "Student profile not found" })

    const existing = await ExamAttempt.findOne({
      examId: req.params.examId,
      studentId: student._id,
    })
    if (existing)
      return res
        .status(409)
        .json({ error: "You have already submitted this exam" })

    const config = await ExamConfig.findOne({ examId: req.params.examId })
    if (!config || !config.isActive)
      return res.status(403).json({ error: "Exam is not active" })

    const questions = await Question.find({ examId: req.params.examId })
    const { answers, time_taken_seconds } = req.body // answers: [{questionId, selectedOption, selectedOptions}]

    const answerMap = {}
    ;(answers || []).forEach((a) => {
      let selectedArr = []
      if (Array.isArray(a.selectedOptions)) {
        selectedArr = a.selectedOptions.map(Number)
      } else if (
        a.selectedOption !== undefined &&
        a.selectedOption !== null &&
        a.selectedOption !== -1 &&
        a.selectedOption !== "-1"
      ) {
        selectedArr = [Number(a.selectedOption)]
      }
      answerMap[a.questionId] = selectedArr
    })

    let score = 0
    let maxScore = 0
    const subjectScores = {}

    config.subjects.forEach((s) => {
      subjectScores[s.subjectId.toString()] = {
        score: 0,
        maxScore: s.totalMarks,
      }
      maxScore += s.totalMarks
    })

    const gradedAnswers = questions.map((q) => {
      const selected = answerMap[q._id.toString()] || []
      const isAttempted = selected.length > 0

      const correct =
        q.correctOptions && q.correctOptions.length > 0
          ? q.correctOptions
          : q.correctOption !== undefined && q.correctOption !== -1
            ? [q.correctOption]
            : []

      const subCfg = config.subjects.find(
        (s) => s.subjectId.toString() === q.subjectId.toString(),
      )
      const marksPerQuestion = subCfg ? subCfg.marksPerQuestion : 0

      let marksEarned = 0
      let isCorrect = false

      if (isAttempted) {
        const hasIncorrect = selected.some((idx) => !correct.includes(idx))
        if (hasIncorrect) {
          marksEarned = config.negativeMarks > 0 ? -config.negativeMarks : 0
        } else {
          const selectedAll = correct.every((idx) => selected.includes(idx))
          if (selectedAll && selected.length === correct.length) {
            marksEarned = marksPerQuestion
            isCorrect = true
          } else {
            marksEarned = selected.length * (marksPerQuestion / 4)
            isCorrect = false
          }
        }
      } else {
        marksEarned = 0
      }

      score += marksEarned
      if (subCfg && subjectScores[q.subjectId.toString()]) {
        subjectScores[q.subjectId.toString()].score += marksEarned
      }

      return {
        questionId: q._id,
        selectedOption: selected.length === 1 ? selected[0] : -1,
        selectedOptions: selected,
        isCorrect: isCorrect,
        marksEarned: marksEarned,
      }
    })

    await ExamAttempt.create({
      examId: req.params.examId,
      studentId: student._id,
      answers: gradedAnswers,
      score,
      maxScore,
      timeTakenSeconds: time_taken_seconds || 0,
    })

    // Write/update score into the Marks table for analytics
    for (const [subId, data] of Object.entries(subjectScores)) {
      try {
        await Mark.findOneAndUpdate(
          {
            studentId: student._id,
            subjectId: subId,
            examId: req.params.examId,
          },
          { marksObtained: data.score, maxMarks: data.maxScore },
          { upsert: true },
        )
      } catch (_) {
        /* non-fatal */
      }
    }

    await checkAndAwardBadges(student._id)

    res.json({
      message:
        "Exam submitted successfully! Results will be available once published by the administrator.",
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Get results for a specific exam (teacher/admin)
app.get("/api/exam-portal/results/:examId", requireLogin, async (req, res) => {
  try {
    if (req.session.role === "student")
      return res.status(403).json({ error: "Access denied" })
    const attempts = await ExamAttempt.find({
      examId: req.params.examId,
    }).populate("studentId")
    res.json({
      results: attempts
        .map((a) => ({
          id: a._id,
          student_name: a.studentId?.name,
          student_id: a.studentId?._id,
          score: a.score,
          max_score: a.maxScore,
          percentage: a.maxScore ? Math.round((a.score / a.maxScore) * 100) : 0,
          time_taken_seconds: a.timeTakenSeconds,
          submitted_at: a.submittedAt,
        }))
        .sort((x, y) => y.score - x.score),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Get detailed analysis of a specific attempt
app.get(
  "/api/exam-portal/attempt-details/:attemptId",
  requireLogin,
  async (req, res) => {
    try {
      const attempt = await ExamAttempt.findById(req.params.attemptId).populate(
        "studentId",
      )
      if (!attempt) return res.status(404).json({ error: "Attempt not found" })

      const config = await ExamConfig.findOne({ examId: attempt.examId })
      const isStudent = req.session.role === "student"

      // Security check
      if (isStudent) {
        if (
          attempt.studentId._id.toString() !== req.session.userId &&
          attempt.studentId.userId?.toString() !== req.session.userId
        ) {
          // Check if user is the student
          const studentUser = await User.findById(req.session.userId)
          if (
            studentUser.studentId?.toString() !==
            attempt.studentId._id.toString()
          ) {
            return res.status(403).json({ error: "Access denied" })
          }
        }
        if (!config || !config.resultsVisible) {
          return res
            .status(403)
            .json({
              error:
                "Results have not been published by the administrator yet.",
            })
        }
      }

      // Fetch questions and enrich answers
      const questions = await Question.find({
        examId: attempt.examId,
      }).populate("subjectId")
      const qMap = Object.fromEntries(
        questions.map((q) => [q._id.toString(), q]),
      )

      const details = attempt.answers.map((ans) => {
        const qIdStr = ans.questionId?.toString()
        let q =
          qMap[qIdStr] ||
          questions.find((item) => item._id.toString() === qIdStr)

        const correct = q
          ? q.correctOptions && q.correctOptions.length > 0
            ? q.correctOptions
            : q.correctOption !== undefined && q.correctOption !== -1
              ? [q.correctOption]
              : []
          : []
        const selected =
          ans.selectedOptions && ans.selectedOptions.length > 0
            ? ans.selectedOptions
            : ans.selectedOption !== undefined &&
                ans.selectedOption !== -1 &&
                ans.selectedOption !== "-1"
              ? [Number(ans.selectedOption)]
              : []

        const isAttempted = selected.length > 0

        let marksEarned = 0
        let isCorrect = false

        if (config && config.subjects) {
          const qSubId = q?.subjectId?._id || q?.subjectId
          const subCfg = config.subjects.find((s) => {
            const sId = s.subjectId?._id || s.subjectId
            return sId?.toString() === qSubId?.toString()
          })
          if (subCfg) {
            const marksPerQuestion = subCfg.marksPerQuestion
            if (isAttempted) {
              const hasIncorrect = selected.some(
                (idx) => !correct.includes(idx),
              )
              if (hasIncorrect) {
                marksEarned =
                  config.negativeMarks > 0 ? -config.negativeMarks : 0
              } else {
                const selectedAll = correct.every((idx) =>
                  selected.includes(idx),
                )
                if (selectedAll && selected.length === correct.length) {
                  marksEarned = marksPerQuestion
                  isCorrect = true
                } else {
                  marksEarned = selected.length * (marksPerQuestion / 4)
                }
              }
            } else {
              marksEarned = 0
            }
          }
        }

        return {
          question_text:
            q?.questionText ||
            q?.question_text ||
            q?.text ||
            "Question content missing",
          image_url: q?.imageUrl || "",
          subject_name: q?.subjectId?.name || "Unknown Subject",
          options: q?.options || [],
          correct_option: correct.length === 1 ? correct[0] : -1,
          correct_options: correct,
          selected_option: selected.length === 1 ? selected[0] : -1,
          selected_options: selected,
          is_correct: isCorrect,
          marks_earned: marksEarned,
        }
      })

      res.json({
        student_name: attempt.studentId?.name,
        score: attempt.score,
        max_score: attempt.maxScore,
        submitted_at: attempt.submittedAt,
        details,
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  },
)

// ─── REPORTS (simple JSON for now) ───────────────────────────
app.get("/api/reports/student/:id", requireLogin, async (req, res) => {
  res.redirect(`/api/analytics/student/${req.params.id}`)
})

// ─── NOTIFICATIONS ROUTE ─────────────────────────────────────
app.post("/api/notifications", requireLogin, async (req, res) => {
  try {
    const { message, targetType, targetClassId, targetStudentId } = req.body
    if (!message) return res.status(400).json({ error: "Message is required" })

    if (req.session.role !== "admin" && req.session.role !== "teacher") {
      return res
        .status(403)
        .json({ error: "Only admins and teachers can send notifications" })
    }

    let senderName = "ADMIN"
    if (req.session.role === "teacher") {
      const teacherUser = await User.findById(req.session.userId)
      senderName = teacherUser ? teacherUser.username : "Teacher"
    }

    const notif = await Notification.create({
      message,
      senderRole: req.session.role,
      senderName,
      targetType: targetType || "all",
      targetClassId: targetClassId || null,
      targetStudentId: targetStudentId || null,
    })

    res.json({ success: true, notification: notif })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/notifications", requireLogin, async (req, res) => {
  try {
    let filter = {}
    if (req.session.role === "student") {
      const user = await User.findById(req.session.userId)
      if (user && user.studentId) {
        const student = await Student.findById(user.studentId)
        if (student) {
          filter = {
            $or: [
              { targetType: "all" },
              { targetType: "class", targetClassId: student.classId },
              { targetType: "student", targetStudentId: student._id },
            ],
          }
        } else {
          filter = { targetType: "all" }
        }
      } else {
        filter = { targetType: "all" }
      }
    }
    const list = await Notification.find(filter)
      .populate("targetClassId", "name")
      .populate("targetStudentId", "name")
      .sort({ createdAt: -1 })
    res.json({ notifications: list })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete("/api/notifications/:id", requireLogin, async (req, res) => {
  try {
    if (req.session.role !== "admin" && req.session.role !== "teacher") {
      return res.status(403).json({ error: "Access denied" })
    }
    await Notification.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: "Notification deleted" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── STUDY MATERIALS ROUTES ───────────────────────────────────

// Create a study material (admin or teacher only)
app.post("/api/materials", requireLogin, async (req, res) => {
  try {
    if (req.session.role !== "admin" && req.session.role !== "teacher") {
      return res.status(403).json({ error: "Admin or Teacher access required" })
    }

    const {
      class_id,
      subject_id,
      chapter_no,
      chapter_name,
      teacher_name,
      youtube_url,
      description,
      file_data,
      file_name,
    } = req.body

    if (!class_id || !subject_id || !chapter_no || !chapter_name) {
      return res
        .status(400)
        .json({
          error:
            "class_id, subject_id, chapter_no, and chapter_name are required",
        })
    }

    // Teacher access check — can only upload for their own classes
    if (req.session.role === "teacher") {
      const teacherClassIds = await getTeacherClasses(req.session.userId)
      if (!teacherClassIds.map((id) => id.toString()).includes(class_id)) {
        return res
          .status(403)
          .json({
            error: "You can only upload materials for your assigned classes",
          })
      }
    }

    const user = await User.findById(req.session.userId)
    const uploaderName = user ? user.username : "Unknown"

    const matObj = {
      classId: class_id,
      subjectId: subject_id,
      chapterNo: Number(chapter_no),
      chapterName: chapter_name.trim(),
      teacherName: teacher_name || "",
      youtubeUrl: youtube_url || "",
      description: description || "",
      fileUrl: "",
      fileName: "",
      uploadedByName: uploaderName,
    }

    // Save PDF/ZIP if base64 data provided
    if (
      file_data &&
      typeof file_data === "string" &&
      file_data.startsWith("data:")
    ) {
      try {
        const matches = file_data.match(/^data:([^;]+);base64,(.+)$/)
        if (matches) {
          const ext = file_name
            ? file_name.split(".").pop().toLowerCase()
            : "bin"
          const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
          const filepath = path.join(materialsDir, safeName)
          fs.writeFileSync(filepath, Buffer.from(matches[2], "base64"))
          matObj.fileUrl = `/uploads/materials/${safeName}`
          matObj.fileName = file_name || safeName
        }
      } catch (err) {
        console.error("Failed to save material file:", err.message)
      }
    }

    const mat = await StudyMaterial.create(matObj)
    res.json({ id: mat._id, message: "Material uploaded successfully" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Get materials for a class + subject (all logged-in users)
app.get("/api/materials", requireLogin, async (req, res) => {
  try {
    const { class_id, subject_id } = req.query
    if (!class_id || !subject_id) {
      return res
        .status(400)
        .json({ error: "class_id and subject_id query params are required" })
    }
    const materials = await StudyMaterial.find({
      classId: class_id,
      subjectId: subject_id,
    }).sort({ chapterNo: 1 })
    res.json({
      materials: materials.map((m) => ({
        id: m._id,
        chapter_no: m.chapterNo,
        chapter_name: m.chapterName,
        teacher_name: m.teacherName,
        youtube_url: m.youtubeUrl,
        description: m.description,
        file_url: m.fileUrl,
        file_name: m.fileName,
        uploaded_by: m.uploadedByName,
        created_at: m.createdAt,
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Get distinct subjects that have materials for a class
app.get("/api/materials/subjects/:classId", requireLogin, async (req, res) => {
  try {
    const { classId } = req.params
    const subjectIds = await StudyMaterial.distinct("subjectId", { classId })
    const subjects = await Subject.find({ _id: { $in: subjectIds } })
    res.json({
      subjects: subjects.map((s) => ({
        id: s._id,
        name: s.name,
        code: s.code,
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Update a study material (admin or teacher only)
app.put("/api/materials/:id", requireLogin, async (req, res) => {
  try {
    if (req.session.role !== "admin" && req.session.role !== "teacher") {
      return res.status(403).json({ error: "Admin or Teacher access required" })
    }

    const mat = await StudyMaterial.findById(req.params.id)
    if (!mat) return res.status(404).json({ error: "Material not found" })

    // Teacher access check — can only edit for their assigned classes
    if (req.session.role === "teacher") {
      const teacherClassIds = await getTeacherClasses(req.session.userId)
      if (
        !teacherClassIds
          .map((id) => id.toString())
          .includes(mat.classId.toString())
      ) {
        return res
          .status(403)
          .json({
            error: "You can only update materials for your assigned classes",
          })
      }
    }

    const {
      chapter_no,
      chapter_name,
      teacher_name,
      youtube_url,
      description,
      file_data,
      file_name,
      remove_file,
    } = req.body

    if (chapter_no !== undefined) mat.chapterNo = Number(chapter_no)
    if (chapter_name !== undefined) mat.chapterName = chapter_name.trim()
    if (teacher_name !== undefined) mat.teacherName = teacher_name || ""
    if (youtube_url !== undefined) mat.youtubeUrl = youtube_url || ""
    if (description !== undefined) mat.description = description || ""

    // Handle file updates
    if (remove_file) {
      // Delete old file
      if (mat.fileUrl) {
        const filePath = path.join(__dirname, mat.fileUrl)
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath)
          } catch (_) {}
        }
      }
      mat.fileUrl = ""
      mat.fileName = ""
    } else if (
      file_data &&
      typeof file_data === "string" &&
      file_data.startsWith("data:")
    ) {
      // Delete old file if exists
      if (mat.fileUrl) {
        const filePath = path.join(__dirname, mat.fileUrl)
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath)
          } catch (_) {}
        }
      }
      // Save new file
      try {
        const matches = file_data.match(/^data:([^;]+);base64,(.+)$/)
        if (matches) {
          const ext = file_name
            ? file_name.split(".").pop().toLowerCase()
            : "bin"
          const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
          const filepath = path.join(materialsDir, safeName)
          fs.writeFileSync(filepath, Buffer.from(matches[2], "base64"))
          mat.fileUrl = `/uploads/materials/${safeName}`
          mat.fileName = file_name || safeName
        }
      } catch (err) {
        console.error("Failed to save material file:", err.message)
        return res.status(500).json({ error: "Failed to save material file" })
      }
    }

    await mat.save()
    res.json({ message: "Material updated successfully", material: mat })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Delete a study material (admin or teacher only)
app.delete("/api/materials/:id", requireLogin, async (req, res) => {
  try {
    if (req.session.role !== "admin" && req.session.role !== "teacher") {
      return res.status(403).json({ error: "Admin or Teacher access required" })
    }
    const mat = await StudyMaterial.findById(req.params.id)
    if (!mat) return res.status(404).json({ error: "Material not found" })

    // Delete file from disk if it exists
    if (mat.fileUrl) {
      const filePath = path.join(__dirname, mat.fileUrl)
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
        } catch (_) {}
      }
    }

    await StudyMaterial.findByIdAndDelete(req.params.id)
    res.json({ message: "Material deleted successfully" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── GAMIFICATION ROUTES ──────────────────────────────────────
app.get("/api/leaderboard/class/:classId", requireLogin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.classId)) {
      return res.status(400).json({ error: "Invalid class ID format" })
    }
    const classId = req.params.classId
    const students = await Student.find({ classId })

    let currentStudentId = null
    if (req.session.role === "student") {
      const user = await User.findById(req.session.userId)
      currentStudentId = user?.studentId?.toString()
    }

    const leaderboardData = []

    for (const s of students) {
      const marks = await Mark.find({ studentId: s._id }).populate(
        "subjectId examId",
      )
      const filteredMarks = await filterRealMarks(marks, true)

      // Overall Average
      const overallAverage = filteredMarks.length
        ? Math.round(
            filteredMarks.reduce(
              (sum, m) => sum + (m.marksObtained / (m.maxMarks || 100)) * 100,
              0,
            ) / filteredMarks.length,
          )
        : 0

      // Improvement Trend
      const examMarks = filteredMarks.filter((m) => m.examId)
      const examsGrouped = {}
      examMarks.forEach((m) => {
        const examIdStr = m.examId._id.toString()
        if (!examsGrouped[examIdStr]) {
          examsGrouped[examIdStr] = { exam: m.examId, marks: [] }
        }
        examsGrouped[examIdStr].marks.push(m)
      })

      const examList = Object.values(examsGrouped)
        .map((g) => {
          const totalObtained = g.marks.reduce(
            (sum, m) => sum + m.marksObtained,
            0,
          )
          const totalMax = g.marks.reduce((sum, m) => sum + m.maxMarks, 0)
          const avg = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
          return {
            date: new Date(g.exam.date || g.exam.createdAt),
            avg: Math.round(avg),
          }
        })
        .sort((a, b) => a.date - b.date)

      let improvementTrend = 0
      if (examList.length >= 2) {
        improvementTrend =
          examList[examList.length - 1].avg - examList[examList.length - 2].avg
      }

      // Display Name resolution
      let displayName = s.name
      if (s.useAlias) {
        displayName = s.alias
          ? s.alias
          : `Anonymous Student #${s.enrollmentNo.slice(-4)}`
      }

      leaderboardData.push({
        studentId: s._id.toString(),
        name: displayName,
        overallAverage,
        improvementTrend,
        badgesCount: s.badges ? s.badges.length : 0,
        isCurrentUser: currentStudentId === s._id.toString(),
      })
    }

    // Sort by overall average descending, then by improvement trend descending
    leaderboardData.sort((a, b) => {
      if (b.overallAverage !== a.overallAverage) {
        return b.overallAverage - a.overallAverage
      }
      return b.improvementTrend - a.improvementTrend
    })

    // Add rank
    leaderboardData.forEach((item, idx) => {
      item.rank = idx + 1
    })

    res.json({ leaderboard: leaderboardData })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put("/api/students/:id/alias", requireLogin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    // Authorization check
    if (req.session.role === "student") {
      const user = await User.findById(req.session.userId)
      if (!user || user.studentId?.toString() !== req.params.id) {
        return res
          .status(403)
          .json({
            error:
              "Access denied: You can only update your own privacy settings.",
          })
      }
    } else if (req.session.role !== "admin" && req.session.role !== "teacher") {
      return res.status(403).json({ error: "Access denied" })
    }

    const { alias, useAlias } = req.body

    const updateData = {}
    if (alias !== undefined) updateData.alias = alias.trim()
    if (useAlias !== undefined) updateData.useAlias = !!useAlias

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true },
    )

    if (!updatedStudent)
      return res.status(404).json({ error: "Student not found" })

    res.json({
      message: "Privacy settings updated successfully",
      student: updatedStudent,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── START ───────────────────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("[DB] Connected to MongoDB")
    const server = app.listen(PORT, () =>
      console.log(`[Server] Running on http://localhost:${PORT}`),
    )
    server.on("error", (err) => {
      console.error("[Server] Error object:", err)
      if (err.code === "EADDRINUSE") {
        console.error(
          `[Server] Port ${PORT} is already in use. Kill the existing process first:\n  lsof -ti:${PORT} | xargs kill -9`,
        )
      } else {
        console.error("[Server] Error:", err.message)
      }
      process.exit(1)
    })
  })
  .catch((err) => {
    console.error("[DB] Connection failed:", err.message)
    process.exit(1)
  })
