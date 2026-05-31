/**
 * AEVON — Unified Admin & Test Scripts
 *
 * Usage: node scripts.js <command>
 *
 * Commands:
 *   setup-admin          Wipe DB and create a fresh admin user
 *   check-users          List all users in the database
 *   cleanup              Remove duplicate marks, exams, subjects and ensure indexes
 *   test-notification    Create a test exam notification and verify it in the DB
 *   test-delete-notif    Login as admin, create and delete a notification via HTTP
 *   test-ai              Run a quick test of the AI analysis logic
 */

require("dotenv").config()

const command = process.argv[2]

if (!command) {
  console.error(
    "Usage: node scripts.js <setup-admin|check-users|cleanup|test-notification|test-delete-notif|test-ai>",
  )
  process.exit(1)
}

// ─── Shared Setup ─────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI

// ─── setup-admin ──────────────────────────────────────────────
async function setupAdmin() {
  const crypto = require("crypto")
  const mongoose = require("mongoose")
  const bcrypt = require("bcryptjs")
  const {
    User,
    Student,
    Class,
    Mark,
    Subject,
    Exam,
    ExamConfig,
    Question,
    ExamAttempt,
  } = require("./models")

  await mongoose.connect(MONGO_URI)
  console.log("[Admin Setup] Connected to MongoDB")

  await Promise.all([
    User.deleteMany(),
    Student.deleteMany(),
    Mark.deleteMany(),
    Class.deleteMany(),
    Subject.deleteMany(),
    Exam.deleteMany(),
    ExamConfig.deleteMany(),
    Question.deleteMany(),
    ExamAttempt.deleteMany(),
  ])
  console.log("[Admin Setup] All data cleared successfully")

  const adminUsername = process.env.ADMIN_USERNAME || "admin"
  const adminPassword =
    process.env.ADMIN_PASSWORD || crypto.randomBytes(10).toString("hex")
  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  await User.create({ username: adminUsername, password: hashedPassword, role: "admin" })

  console.log(`[Admin Setup] Admin user created: username="${adminUsername}"`)
  if (process.env.ADMIN_PASSWORD) {
    console.log("[Admin Setup] Admin password was provided via ADMIN_PASSWORD and is not printed here.")
  } else {
    console.log(`[Admin Setup] Generated admin password: ${adminPassword}`)
    console.log("[Admin Setup] No ADMIN_PASSWORD environment variable was set; save this password now.")
  }

  await mongoose.disconnect()
}

// ─── check-users ──────────────────────────────────────────────
async function checkUsers() {
  const mongoose = require("mongoose")
  const { User } = require("./models")

  await mongoose.connect(MONGO_URI)
  const users = await User.find({}, { username: 1, role: 1 })
  console.log("--- Current Users in Database ---")
  if (users.length === 0) {
    console.log("No users found. Database might be empty.")
  } else {
    users.forEach((u) => console.log(`- ${u.username} (${u.role})`))
  }
  await mongoose.disconnect()
}

// ─── cleanup ──────────────────────────────────────────────────
async function cleanup() {
  const mongoose = require("mongoose")
  const { Mark, Exam, Subject } = require("./models")

  const CLEANUP_URI = MONGO_URI || "mongodb://127.0.0.1:27017/eduanalytics"
  await mongoose.connect(CLEANUP_URI)
  console.log("Connected to DB")

  // Duplicate marks
  const marks = await Mark.find().populate("examId subjectId studentId")
  console.log(`Total marks: ${marks.length}`)
  const seen = new Set()
  const toDelete = []
  for (const m of marks) {
    const key = `${m.studentId?._id || m.studentId}-${m.subjectId?._id || m.subjectId}-${m.examId?._id || m.examId || "null"}`
    if (seen.has(key)) {
      console.log(`Found duplicate: ${key} (ID: ${m._id})`)
      toDelete.push(m._id)
    } else {
      seen.add(key)
    }
  }
  if (toDelete.length > 0) {
    console.log(`Deleting ${toDelete.length} duplicates...`)
    await Mark.deleteMany({ _id: { $in: toDelete } })
    console.log("Done.")
  } else {
    console.log("No duplicate marks found.")
  }

  // Duplicate exams
  const exams = await Exam.find()
  const seenExams = new Set()
  const examToDelete = []
  for (const e of exams) {
    const key = `${e.name}-${e.classId}`
    if (seenExams.has(key)) {
      console.log(`Found duplicate exam: ${key} (ID: ${e._id})`)
      examToDelete.push(e._id)
    } else {
      seenExams.add(key)
    }
  }
  if (examToDelete.length > 0) {
    await Exam.deleteMany({ _id: { $in: examToDelete } })
    console.log(`Deleted ${examToDelete.length} duplicate exams.`)
  }

  // Duplicate subjects
  const subjects = await Subject.find()
  const seenSubs = new Set()
  const subToDelete = []
  for (const s of subjects) {
    const key = `${s.name}-${s.classId}`
    if (seenSubs.has(key)) {
      console.log(`Found duplicate subject: ${key} (ID: ${s._id})`)
      subToDelete.push(s._id)
    } else {
      seenSubs.add(key)
    }
  }
  if (subToDelete.length > 0) {
    await Subject.deleteMany({ _id: { $in: subToDelete } })
    console.log(`Deleted ${subToDelete.length} duplicate subjects.`)
  }

  // Ensure indexes
  try {
    await Mark.collection.createIndex({ studentId: 1, subjectId: 1, examId: 1 }, { unique: true })
    await Exam.collection.createIndex({ name: 1, classId: 1 }, { unique: true })
    await Subject.collection.createIndex({ name: 1, classId: 1 }, { unique: true })
    console.log("All unique indexes ensured.")
  } catch (err) {
    console.error("Index creation failed:", err.message)
  }

  process.exit(0)
}

// ─── test-notification ────────────────────────────────────────
async function testNotification() {
  const mongoose = require("mongoose")
  const { User, Class, Notification } = require("./models")

  await mongoose.connect(MONGO_URI)
  console.log("Connected to MongoDB")

  const cls = await Class.findOne()
  if (!cls) {
    console.log("No class found in database. Please run setup-admin first.")
    process.exit(1)
  }
  console.log(`Using class: ${cls.name} (${cls._id})`)

  const admin = await User.findOne({ role: "admin" })
  const senderName = admin ? admin.username : "Administrator"
  console.log(`Using admin user: ${senderName}`)

  const name = "Calculus Final Exam"
  const date = "2026-06-15T10:30:00"
  const description =
    "Calculus and Geometry basics. Integration by parts, Taylor series, and basic coordinate geometry."

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

  const message = `Hello! A new exam, "${name}", has been scheduled for class "${cls.name}" on ${formattedDateTime}. The topics included in this exam are: ${description || "all general class topics"}. Please take a deep breath, prepare gently at your own pace, and remember that you are capable of amazing things. Wishing you the absolute best of luck!`

  console.log("\n--- Generated Message ---")
  console.log(message)
  console.log("-------------------------\n")

  const notif = await Notification.create({
    message,
    senderRole: "admin",
    senderName,
    targetType: "class",
    targetClassId: cls._id,
  })
  console.log("Notification successfully created in database!")
  console.log("Notif ID:", notif._id)

  const fetchedNotif = await Notification.findById(notif._id)
  console.log("Fetched notification message matches:", fetchedNotif.message === message)

  await Notification.deleteOne({ _id: notif._id })
  console.log("Cleanup completed successfully.")

  await mongoose.disconnect()
}

// ─── test-delete-notif ────────────────────────────────────────
async function testDeleteNotif() {
  const http = require("http")

  function makeRequest(url, method, headers, body) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
      }
      const req = http.request(options, (res) => {
        let data = ""
        res.on("data", (chunk) => { data += chunk })
        res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }))
      })
      req.on("error", reject)
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  }

  const adminUsername = process.env.ADMIN_USERNAME || "admin"
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    console.error("Missing ADMIN_PASSWORD environment variable. Set ADMIN_PASSWORD before running this test.")
    process.exit(1)
  }

  console.log("1. Logging in as admin...")
  const loginRes = await makeRequest(
    "http://localhost:6060/api/auth/login",
    "POST",
    { "Content-Type": "application/json" },
    { username: adminUsername, password: adminPassword },
  )
  console.log("Login Status:", loginRes.statusCode)
  console.log("Login Body:", loginRes.body)

  const cookie = loginRes.headers["set-cookie"] ? loginRes.headers["set-cookie"][0] : ""
  console.log("Cookie:", cookie)
  if (!cookie) { console.error("Failed to get session cookie"); process.exit(1) }

  console.log("\n2. Creating a notification...")
  const createRes = await makeRequest(
    "http://localhost:6060/api/notifications",
    "POST",
    { "Content-Type": "application/json", Cookie: cookie },
    { message: "Test notification delete", targetType: "all" },
  )
  console.log("Create Status:", createRes.statusCode)
  console.log("Create Body:", createRes.body)

  const notif = JSON.parse(createRes.body)
  const notifId = notif.notification ? notif.notification._id : null
  console.log("Created Notification ID:", notifId)
  if (!notifId) { console.error("Failed to get notification ID"); process.exit(1) }

  console.log("\n3. Deleting the notification...")
  const deleteRes = await makeRequest(
    `http://localhost:6060/api/notifications/${notifId}`,
    "DELETE",
    { Cookie: cookie },
  )
  console.log("Delete Status:", deleteRes.statusCode)
  console.log("Delete Body:", deleteRes.body)
}

// ─── test-ai ──────────────────────────────────────────────────
async function testAI() {
  // Inline the fallback analysis function for a standalone smoke-test
  function generateFallbackAnalysis(data) {
    const allSubjectsZero =
      data.subjectAverages.length > 0 &&
      data.subjectAverages.every((s) => s.avg === 0)
    const isNewStudent = allSubjectsZero
    const riskLevel = isNewStudent ? "low" : data.overallAverage < 50 ? "high" : "low"
    return {
      riskLevel,
      predictions: data.subjectAverages.map((s) => ({
        subject: s.name,
        currentAvg: s.avg,
        predictedNext: isNewStudent ? 70 : Math.min(100, Math.round(s.avg * 1.05)),
        trend: isNewStudent ? "new_student" : s.avg > 60 ? "stable" : "needs_improvement",
      })),
      recommendations: [],
      generalAdvice: ["Test run completed."],
    }
  }

  const result = generateFallbackAnalysis({
    name: "Test Student",
    className: "10A",
    enrollmentNo: "TEST001",
    marks: [],
    subjectAverages: [{ name: "Math", avg: 55 }, { name: "Science", avg: 70 }],
    overallAverage: 62,
  })
  console.log("AI Test Result:")
  console.log(JSON.stringify(result, null, 2))
  console.log("AI test completed successfully.")
}

// ─── Command Router ───────────────────────────────────────────
;(async () => {
  try {
    switch (command) {
      case "setup-admin":
        await setupAdmin()
        break
      case "check-users":
        await checkUsers()
        break
      case "cleanup":
        await cleanup()
        break
      case "test-notification":
        await testNotification()
        break
      case "test-delete-notif":
        await testDeleteNotif()
        break
      case "test-ai":
        await testAI()
        break
      default:
        console.error(`Unknown command: "${command}"`)
        console.error("Valid commands: setup-admin, check-users, cleanup, test-notification, test-delete-notif, test-ai")
        process.exit(1)
    }
    process.exit(0)
  } catch (e) {
    console.error("Error:", e.message)
    process.exit(1)
  }
})()
