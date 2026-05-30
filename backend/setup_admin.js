const crypto = require("crypto")
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const { MONGO_URI } = require("./config")
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

async function setupAdmin() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log("[Admin Setup] Connected to MongoDB")

    // 1. Delete all existing data
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

    // 2. Create the Admin user
    const adminUsername = process.env.ADMIN_USERNAME || "admin"
    const adminPassword =
      process.env.ADMIN_PASSWORD || crypto.randomBytes(10).toString("hex")
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    await User.create({
      username: adminUsername,
      password: hashedPassword,
      role: "admin",
    })

    console.log(`[Admin Setup] Admin user created: username="${adminUsername}"`)
    if (process.env.ADMIN_PASSWORD) {
      console.log(
        "[Admin Setup] Admin password was provided via ADMIN_PASSWORD and is not printed here.",
      )
    } else {
      console.log(`[Admin Setup] Generated admin password: ${adminPassword}`)
      console.log(
        "[Admin Setup] No ADMIN_PASSWORD environment variable was set; save this password now.",
      )
    }

    await mongoose.disconnect()
  } catch (e) {
    console.error("Error:", e.message)
    process.exit(1)
  }
}

setupAdmin()
