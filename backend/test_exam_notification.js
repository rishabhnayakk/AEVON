const mongoose = require("mongoose")
const { MONGO_URI } = require("./config")
const { User, Class, Exam, Notification } = require("./models")

async function test() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log("Connected to MongoDB")

    // Find a class
    const cls = await Class.findOne()
    if (!cls) {
      console.log("No class found in database. Please run seed script first.")
      process.exit(1)
    }
    console.log(`Using class: ${cls.name} (${cls._id})`)

    // Find an admin user to simulate session
    const admin = await User.findOne({ role: "admin" })
    const senderName = admin ? admin.username : "Administrator"
    console.log(`Using admin user: ${senderName}`)

    // Input simulation
    const name = "Calculus Final Exam"
    const date = "2026-06-15T10:30:00"
    const description =
      "Calculus and Geometry basics. Integration by parts, Taylor series, and basic coordinate geometry."

    // Formatter logic
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

    // Create the notification in DB for verification
    const notif = await Notification.create({
      message,
      senderRole: "admin",
      senderName,
      targetType: "class",
      targetClassId: cls._id,
    })
    console.log("Notification successfully created in database!")
    console.log("Notif ID:", notif._id)

    // Fetch it back to verify
    const fetchedNotif = await Notification.findById(notif._id)
    console.log(
      "Fetched notification message matches:",
      fetchedNotif.message === message,
    )

    // Cleanup
    await Notification.deleteOne({ _id: notif._id })
    console.log("Cleanup completed successfully.")

    await mongoose.disconnect()
  } catch (e) {
    console.error("Error in test:", e)
    process.exit(1)
  }
}

test()
