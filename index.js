const db = require('./database');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.get('/', (req, res) => {
    res.send('AI Exam Grader backend is running');
});

app.post('/evaluate', async (req, res) => {
    try {
        const { students, questions, answers } = req.body;

        if (!students || !questions || !answers) {
            return res.status(400).json({ error: "Missing students, questions or answers data" });
        }

        let scores = {};

        for (const student of students) {
            let totalScore = 0;
            let feedbacks = [];

            // öğrenciyi veritabanına ekleme
            db.run(
                `INSERT OR IGNORE INTO students (schoolNumber) VALUES (?)`,
                [student.schoolNumber],
                function (err) {
                    if (err) {
                        console.error(" öğrenci eklenirken hata:", err.message);
                    } else {
                        console.log(` öğrenci eklendi (veya zaten vardı): ${student.schoolNumber}`);
                    }
                }
            );

            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                const studentAnswer = (answers[student.id] && answers[student.id][i]) || "";
                const expectedAnswer = question.expectedAnswer;

                // soruyu veritabanına ekle
                db.run(
                    `INSERT OR IGNORE INTO questions (questionText, expectedAnswer) VALUES (?, ?)`,
                    [question.questionText, expectedAnswer],
                    function (err) {
                        if (err) {
                            console.error(" soru eklenirken hata:", err.message);
                        } else {
                            console.log(` soru eklendi (veya zaten vardı): "${question.questionText}"`);
                        }
                    }
                );

                const prompt = `
Soru: ${question.questionText}
Beklenen Cevap: ${expectedAnswer}
Öğrenci Cevabı: ${studentAnswer}

Öğrencinin cevabını 0'dan 100'e kadar puanla. Sadece puanla birlikte kısa bir geribildirim de ver.
Yanıt formatı: PUAN: [sayı] - Geribildirim: [yorum]
`;

                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: "gpt-4o-mini",
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0,
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${OPENAI_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 120000 // 2 dakika verdim
                    }
                );

                const content = response.data.choices[0].message.content.trim();

                let scoreMatch = content.match(/PUAN[:：]?\s*(\d+)/i);
                let feedbackMatch = content.match(/Geribildirim[:：]?\s*(.+)/i);

                let score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
                let feedback = feedbackMatch ? feedbackMatch[1] : "Geri bildirim yok.";

                totalScore += score;
                feedbacks.push({ questionIndex: i, feedback });

                // cevabı veritabanına ekle
                db.run(
                    `INSERT INTO answers (studentId, questionId, studentAnswer, score, feedback)
                     VALUES (
                       (SELECT id FROM students WHERE schoolNumber = ?),
                       (SELECT id FROM questions WHERE questionText = ?),
                       ?, ?, ?
                     )`,
                    [student.schoolNumber, question.questionText, studentAnswer, score, feedback],
                    function (err) {
                        if (err) {
                            console.error(" cevap kaydedilirken hata:", err.message);
                        } else {
                            console.log(` cevap kaydedildi → Öğrenci: ${student.schoolNumber}, Soru: "${question.questionText}", Puan: ${score}`);
                        }
                    }
                );
            }

            scores[student.id] = {
                averageScore: Math.round(totalScore / questions.length),
                feedbacks,
            };
        }

        return res.json({ scores });

    } catch (error) {
        console.error("Evaluation error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(` Server running on http://localhost:${PORT}`);
});
