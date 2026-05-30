const mongoose = require("mongoose")
const { MONGO_URI } = require("./config")
const { User } = require("./models")

async function checkUsers() {
  try {
    await mongoose.connect(MONGO_URI)
    const users = await User.find({}, { username: 1, role: 1 })
    console.log("--- Current Users in Database ---")
    if (users.length === 0) {
      console.log("No users found. Database might be empty.")
    } else {
      users.forEach((u) => console.log(`- ${u.username} (${u.role})`))
    }
    await mongoose.disconnect()
  } catch (e) {
    console.error("Error:", e.message)
  }
}

checkUsers()
