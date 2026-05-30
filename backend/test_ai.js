const { MongoClient } = require("mongodb")
async function test() {
  const client = new MongoClient("mongodb://127.0.0.1:27017")
  await client.connect()
  const db = client.db("eduanalytics")
  const student = await db.collection("students").findOne()
  if (!student) {
    console.log("No student found")
    process.exit(1)
  }
  console.log("Testing with student id:", student._id.toString())
  const res = await fetch(
    "http://localhost:6050/api/ai/predict/" + student._id.toString(),
    {
      // Need to simulate login session, or I can just test `ai.js` directly
    },
  )
  console.log("To test via HTTP, we need auth. Testing ai.js directly...")
  const { analyzeStudent } = require("./ai.js")
  const result = await analyzeStudent({
    name: student.name,
    className: "10A",
    enrollmentNo: "123",
    marks: [],
    subjectAverages: [],
    overallAverage: 50,
    attendanceRate: 50,
  })
  console.log(result)
  process.exit(0)
}
test()
