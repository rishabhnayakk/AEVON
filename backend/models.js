const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["teacher", "student", "admin"],
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true },
)

const classSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
})

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: "" },
    enrollmentNo: { type: String, required: true, unique: true },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    alias: { type: String, default: "" },
    useAlias: { type: Boolean, default: false },
    badges: [
      {
        name: { type: String, required: true },
        description: { type: String, required: true },
        icon: { type: String, required: true },
        awardedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
)

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  },
})
subjectSchema.index({ name: 1, classId: 1 }, { unique: true })

const examSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
    description: { type: String, default: "" },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    totalMarks: { type: Number, default: 100, min: 1 },
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed"],
      default: "scheduled",
    },
  },
  { timestamps: true },
)
examSchema.index({ name: 1, classId: 1 }, { unique: true })

const markSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", default: null },
  marksObtained: { type: Number, required: true, min: 0 },
  maxMarks: { type: Number, default: 100, min: 1 },
})
markSchema.index({ studentId: 1, subjectId: 1, examId: 1 }, { unique: true })

const examConfigSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      unique: true,
    },
    subjects: [
      {
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
          required: true,
        },
        totalMarks: { type: Number, required: true, min: 1 },
        totalQuestions: { type: Number, required: true, min: 1 },
        marksPerQuestion: { type: Number, required: true, min: 0.1 },
      },
    ],
    durationMinutes: { type: Number, required: true, min: 1, default: 60 },
    isActive: { type: Boolean, default: false }, 
    resultsVisible: { type: Boolean, default: false }, 
    startsAt: { type: Date, default: null }, 
    loginWindowMinutes: { type: Number, default: 15, min: 1 }, 
    strictForwardOnly: { type: Boolean, default: false }, 
    timePerQuestionSeconds: { type: Number, default: 0 }, 
    negativeMarks: { type: Number, default: 0, min: 0 }, 
  },
  { timestamps: true },
)

const questionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    questionText: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    options: {
      type: [String],
      validate: (v) => v.length === 4,
      required: true,
    }, 
    correctOption: { type: Number }, 
    correctOptions: { type: [Number], default: [] }, 
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
)

const examAttemptSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    answers: [
      {
        questionId: mongoose.Schema.Types.ObjectId,
        selectedOption: Number, 
        selectedOptions: { type: [Number], default: [] },
        isCorrect: { type: Boolean, default: false },
        marksEarned: { type: Number, default: 0 },
      },
    ],
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
examAttemptSchema.index({ examId: 1, studentId: 1 }, { unique: true }) 

const notificationSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    senderRole: { type: String, enum: ["admin", "teacher"], required: true },
    senderName: { type: String, required: true },
    targetType: {
      type: String,
      enum: ["all", "class", "student"],
      default: "all",
    },
    targetClassId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },
    targetStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
  },
  { timestamps: true },
)

notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 14 * 24 * 60 * 60 },
)

const studyMaterialSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    chapterNo: { type: Number, required: true, min: 1 },
    chapterName: { type: String, required: true },
    teacherName: { type: String, default: "" }, 
    youtubeUrl: { type: String, default: "" }, 
    description: { type: String, default: "" }, 
    fileUrl: { type: String, default: "" }, 
    fileName: { type: String, default: "" }, 
    uploadedByName: { type: String, default: "" },
  },
  { timestamps: true },
)
studyMaterialSchema.index({ classId: 1, subjectId: 1, chapterNo: 1 })

module.exports = {
  User: mongoose.model("User", userSchema),
  Class: mongoose.model("Class", classSchema),
  Student: mongoose.model("Student", studentSchema),
  Subject: mongoose.model("Subject", subjectSchema),
  Exam: mongoose.model("Exam", examSchema),
  Mark: mongoose.model("Mark", markSchema),
  ExamConfig: mongoose.model("ExamConfig", examConfigSchema),
  Question: mongoose.model("Question", questionSchema),
  ExamAttempt: mongoose.model("ExamAttempt", examAttemptSchema),
  Notification: mongoose.model("Notification", notificationSchema),
  StudyMaterial: mongoose.model("StudyMaterial", studyMaterialSchema),
}
