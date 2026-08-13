const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const MAX_SUBJECTS = 4;
const QUESTIONS_PER_SUBJECT = 15;
const EXAM_MINUTES = 30;
const EXAM_GRACE_SECONDS = 30;
const ALLOWED_SUBJECTS = new Set(['Use of English','Mathematics','Physics','Chemistry','Biology','Economics','Government','Literature in English','Financial Accounting','Commerce','Geography','Agricultural Science','Christian Religious Studies']);
const RATE_WINDOW_MS = 60 * 1000;

function requireAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
}
function requireVerifiedAuth(req) {
  // Practice app: authentication is sufficient; email verification is not required.
  requireAuth(req);
}
function cleanString(v, max = 300) { return String(v ?? '').trim().slice(0, max); }
function canonicalSubject(v) {
  const k = cleanString(v, 80).toLowerCase().replace(/\s+/g, ' ');
  const aliases = {
    english: 'Use of English', 'use of english': 'Use of English',
    math: 'Mathematics', mathematics: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology',
    economics: 'Economics', government: 'Government', literature: 'Literature in English', 'literature in english': 'Literature in English',
    accounting: 'Financial Accounting', 'financial accounting': 'Financial Accounting', commerce: 'Commerce', geography: 'Geography',
    agriculture: 'Agricultural Science', 'agricultural science': 'Agricultural Science',
    crs: 'Christian Religious Studies', 'christian religious studies': 'Christian Religious Studies'
  };
  return aliases[k] || cleanString(v, 80);
}
function subjectAliases(subject) {
  const map = {
    'Use of English': ['Use of English','English','English Language'],
    'Mathematics': ['Mathematics','Math'],
    'Literature in English': ['Literature in English','Literature'],
    'Financial Accounting': ['Financial Accounting','Accounting'],
    'Agricultural Science': ['Agricultural Science','Agriculture'],
    'Christian Religious Studies': ['Christian Religious Studies','CRS']
  };
  return map[subject] || [subject];
}
function validateSubjects(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SUBJECTS) throw new HttpsError('invalid-argument', 'Choose between 1 and 4 subjects.');
  const subjects = [...new Set(raw.map(canonicalSubject).filter(Boolean))];
  if (subjects.length !== raw.length) throw new HttpsError('invalid-argument', 'Subjects must be unique.');
  if (subjects.some(s => !ALLOWED_SUBJECTS.has(s))) throw new HttpsError('invalid-argument', 'One or more subjects are not supported.');
  return subjects;
}
async function rateLimit(uid, action, maxCalls = 5) {
  const ref = db.doc(`rateLimits/${uid}_${action}`);
  const now = Date.now();
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    const recent = Number(d.windowStart || 0) > now - RATE_WINDOW_MS ? Number(d.count || 0) : 0;
    if (recent >= maxCalls) throw new HttpsError('resource-exhausted', 'Too many requests. Please wait a minute and try again.');
    tx.set(ref, { windowStart: recent ? Number(d.windowStart) : now, count: recent + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
}

function normalizeAnswer(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  const text = String(v ?? '').trim().toUpperCase();
  if (/^[0-3]$/.test(text)) return Number(text);
  if (/^[A-D]$/.test(text)) return text.charCodeAt(0) - 65;
  return NaN;
}

function publicQuestion(id, q) {
  return {
    id,
    subject: canonicalSubject(q.subject),
    topic: cleanString(q.topic, 120),
    question: cleanString(q.question, 3000),
    options: Array.isArray(q.options) ? q.options.slice(0, 4).map(v => cleanString(v, 1000)) : []
  };
}

// Secure exam delivery: the answer key is deliberately never returned here.
exports.startExam = onCall(async req => {
  requireVerifiedAuth(req);
  await rateLimit(req.auth.uid, 'startExam', 5);
  const subjects = validateSubjects(req.data?.subjects);
  const selected = [];

  for (const subject of subjects) {
    const snap = await db.collection('questions')
      .where('subject', 'in', subjectAliases(subject))
      .limit(200)
      .get();
    const keySnaps = await db.getAll(...snap.docs.map(d => db.doc(`answerKeys/${d.id}`)));
    const keyMap = new Map(keySnaps.map(k => [k.id, k.exists ? k.data() : {}]));
    const pool = snap.docs.map(d => {
      const q = { ...d.data() };
      if (q.correctAnswer == null) {
        const k = keyMap.get(d.id) || {};
        q.correctAnswer = k.correctAnswer ?? k.answer ?? k.correct ?? k.key;
      }
      return { doc: d, data: q };
    }).filter(item => {
      const q = item.data;
      const answer = normalizeAnswer(q.correctAnswer);
      return Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(answer) && answer >= 0 && answer <= 3 && cleanString(q.question, 3000).length > 0;
    });
    if (pool.length < QUESTIONS_PER_SUBJECT) {
      throw new HttpsError('failed-precondition', `Not enough active questions for ${subject}.`);
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    selected.push(...pool.slice(0, QUESTIONS_PER_SUBJECT).map(item => ({ id: item.doc.id, data: item.data })));
  }

  const examId = `exam_${req.auth.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + EXAM_MINUTES * 60 * 1000 + EXAM_GRACE_SECONDS * 1000);
  await db.doc(`users/${req.auth.uid}/examSessions/${examId}`).set({
    subjects,
    questionIds: selected.map(x => x.id),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
    submitted: false,
    version: 13
  });

  return {
    examId,
    expiresAt: expiresAt.toMillis(),
    questions: selected.map(x => publicQuestion(x.id, x.data))
  };
});

exports.submitExam = onCall(async req => {
  requireVerifiedAuth(req);
  await rateLimit(req.auth.uid, 'submitExam', 10);
  const examId = cleanString(req.data?.examId, 120);
  const rawAnswers = req.data?.answers;
  if (!examId || !rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) {
    throw new HttpsError('invalid-argument', 'Invalid exam submission.');
  }
  const answers = {};
  for (const [id, value] of Object.entries(rawAnswers)) {
    if (Object.keys(answers).length >= 100) throw new HttpsError('invalid-argument', 'Submission is too large.');
    const n = Number(value);
    if (!/^[-A-Za-z0-9_]{1,150}$/.test(id) || !Number.isInteger(n) || n < 0 || n > 3) continue;
    answers[id] = n;
  }

  const sessionRef = db.doc(`users/${req.auth.uid}/examSessions/${examId}`);
  const resultRef = db.doc(`users/${req.auth.uid}/results/${examId}`);
  const result = await db.runTransaction(async tx => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) throw new HttpsError('not-found', 'Exam session not found.');
    const session = sessionSnap.data();
    if (session.submitted === true) throw new HttpsError('already-exists', 'This exam has already been submitted.');
    const expiry = session.expiresAt?.toMillis?.() || 0;
    if (!expiry || Date.now() > expiry) throw new HttpsError('deadline-exceeded', 'This exam has expired.');

    const ids = Array.isArray(session.questionIds) ? session.questionIds : [];
    if (!ids.length || ids.length > MAX_SUBJECTS * QUESTIONS_PER_SUBJECT) throw new HttpsError('failed-precondition', 'Invalid exam session.');
    const refs = ids.map(id => db.doc(`questions/${id}`));
    const questionSnaps = await tx.getAll(...refs);
    const keyRefs = ids.map(id => db.doc(`answerKeys/${id}`));
    const keySnaps = await tx.getAll(...keyRefs);
    const keyMap = new Map(keySnaps.map(k => [k.id, k.exists ? k.data() : {}]));
    const questions = questionSnaps.map((snap, i) => ({ snap, id: ids[i] })).filter(x => {
      if (!x.snap.exists) return false;
      const d = x.snap.data();
      return d.active !== false && d.approved !== false;
    });
    if (questions.length !== ids.length) throw new HttpsError('failed-precondition', 'Some exam questions are no longer available.');

    let score = 0, wrong = 0, unanswered = 0;
    const sections = {};
    const review = questions.map((item, i) => {
      const q = { ...item.snap.data() };
      if (q.correctAnswer == null) { const k = keyMap.get(item.id) || {}; q.correctAnswer = k.correctAnswer ?? k.answer ?? k.correct ?? k.key; }
      const selected = Object.prototype.hasOwnProperty.call(answers, item.id) ? answers[item.id] : null;
      const correctAnswer = normalizeAnswer(q.correctAnswer);
      const isCorrect = selected !== null && selected === correctAnswer;
      if (isCorrect) score++; else if (selected === null) unanswered++; else wrong++;
      const subject = canonicalSubject(q.subject);
      sections[subject] ||= { subject, score: 0, total: 0 };
      sections[subject].total++;
      if (isCorrect) sections[subject].score++;
      return {
        id: item.id, number: i + 1, subject, topic: cleanString(q.topic, 120),
        question: cleanString(q.question, 3000), options: Array.isArray(q.options) ? q.options.slice(0, 4).map(v => cleanString(v, 1000)) : [],
        selected, correctAnswer, correct: isCorrect,
        explanation: cleanString(q.explanation, 3000)
      };
    });
    const total = review.length;
    const percentage = total ? Math.round(score / total * 100) : 0;
    const sectionsArr = Object.values(sections).map(s => ({ ...s, percentage: s.total ? Math.round(s.score / s.total * 100) : 0 }));
    const recommendation = percentage >= 80
      ? 'Excellent work. Keep practicing consistently and review the few questions you missed.'
      : percentage >= 60
        ? 'Good progress. Review the explanations for the questions you missed and attempt another mock.'
        : 'Use the review below to identify weak topics, then practice those topics before your next mock.';
    const clean = {
      id: examId, examName: 'JAMB Practice Test', subjects: session.subjects || [],
      score, total, percentage, correct: score, wrong, unanswered, sections: sectionsArr, review,
      submittedAt: new Date().toISOString(), recommendation,
      serverVersion: 13, syncedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    tx.set(resultRef, clean, { merge: false });
    tx.update(sessionRef, { submitted: true, submittedAt: admin.firestore.FieldValue.serverTimestamp() });
    return clean;
  });
  return { ok: true, result };
});

exports.getAttempt = onCall(async req => {
  requireVerifiedAuth(req);
  const id = cleanString(req.data?.attemptId, 120);
  if (!id) throw new HttpsError('invalid-argument', 'Attempt ID is required.');
  const snap = await db.doc(`users/${req.auth.uid}/results/${id}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Result not found.');
  return { result: snap.data() };
});
