const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// grader.sqlite dosyasının tam yolu
const dbPath = path.resolve(__dirname, 'grader.sqlite');

// Veritabanına bağlan
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ SQLite connection failed:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// Gerekli tabloları oluştur
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schoolNumber TEXT UNIQUE
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionText TEXT UNIQUE,
    expectedAnswer TEXT
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId INTEGER,
    questionId INTEGER,
    studentAnswer TEXT,
    score INTEGER,
    feedback TEXT,
    FOREIGN KEY (studentId) REFERENCES students(id),
    FOREIGN KEY (questionId) REFERENCES questions(id)
  )`);
});

module.exports = db;
