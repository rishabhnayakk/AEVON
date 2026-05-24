const mongoose = require('mongoose');
const { Mark, Exam, Subject } = require('./models');

const MONGO_URI = 'mongodb://127.0.0.1:27017/eduanalytics'; // Corrected case

async function cleanup() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    const marks = await Mark.find().populate('examId subjectId studentId');
    console.log(`Total marks: ${marks.length}`);

    const seen = new Set();
    const toDelete = [];

    for (const m of marks) {
        const key = `${m.studentId?._id || m.studentId}-${m.subjectId?._id || m.subjectId}-${m.examId?._id || m.examId || 'null'}`;
        if (seen.has(key)) {
            console.log(`Found duplicate: ${key} (ID: ${m._id})`);
            toDelete.push(m._id);
        } else {
            seen.add(key);
        }
    }

    if (toDelete.length > 0) {
        console.log(`Deleting ${toDelete.length} duplicates...`);
        await Mark.deleteMany({ _id: { $in: toDelete } });
        console.log('Done.');
    } else {
        console.log('No duplicates found.');
    }

    // --- Duplicate Exams Cleanup ---
    const exams = await Exam.find();
    const seenExams = new Set();
    const examToDelete = [];
    for (const e of exams) {
        const key = `${e.name}-${e.classId}`;
        if (seenExams.has(key)) {
            console.log(`Found duplicate exam: ${key} (ID: ${e._id})`);
            examToDelete.push(e._id);
            // Move any marks from this duplicate exam to the first one?
            // For now, just delete.
        } else {
            seenExams.add(key);
        }
    }
    if (examToDelete.length > 0) {
        await Exam.deleteMany({ _id: { $in: examToDelete } });
        console.log(`Deleted ${examToDelete.length} duplicate exams.`);
    }

    // --- Duplicate Subjects Cleanup ---
    const subjects = await Subject.find();
    const seenSubs = new Set();
    const subToDelete = [];
    for (const s of subjects) {
        const key = `${s.name}-${s.classId}`;
        if (seenSubs.has(key)) {
            console.log(`Found duplicate subject: ${key} (ID: ${s._id})`);
            subToDelete.push(s._id);
        } else {
            seenSubs.add(key);
        }
    }
    if (subToDelete.length > 0) {
        await Subject.deleteMany({ _id: { $in: subToDelete } });
        console.log(`Deleted ${subToDelete.length} duplicate subjects.`);
    }

    // Ensure all unique indexes
    try {
        await Mark.collection.createIndex({ studentId: 1, subjectId: 1, examId: 1 }, { unique: true });
        await Exam.collection.createIndex({ name: 1, classId: 1 }, { unique: true });
        await Subject.collection.createIndex({ name: 1, classId: 1 }, { unique: true });
        console.log('All unique indexes ensured.');
    } catch (err) {
        console.error('Index creation failed:', err.message);
    }

    process.exit(0);
}

cleanup();
