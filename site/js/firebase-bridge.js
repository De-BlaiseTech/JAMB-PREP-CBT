import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function signIn(email, password) {
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}

export async function register(email, password) {
  return (await createUserWithEmailAndPassword(auth, email, password)).user;
}

export async function sendVerification(user) {
  return sendEmailVerification(user, {
    url: new URL("index.html", window.location.href).href,
    handleCodeInApp: false
  });
}

export async function resendVerification(user) {
  return sendVerification(user);
}

export async function sendReset(email) {
  return sendPasswordResetEmail(auth, email, {
    url: new URL("index.html", window.location.href).href,
    handleCodeInApp: false
  });
}

export async function currentUser() {
  if (auth.currentUser) return auth.currentUser;
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      resolve(user || null);
    });
  });
}

export async function logout() {
  if (auth.currentUser) return signOut(auth);
}

export function uid() {
  return auth.currentUser?.uid || "";
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeExamId() {
  return (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function startExam(subjects) {
  const u = await currentUser();
  if (!u) throw new Error("Please sign in before starting a test.");
  if (!Array.isArray(subjects) || subjects.length !== 4 || new Set(subjects).size !== 4) {
    throw new Error("Please choose four different subjects.");
  }

  // Build the exam as four separate subject blocks.
  // Each subject gets 15 randomized questions, but the blocks themselves
  // remain in exactly the order selected by the student.
  const questionsBySubject = {};

  for (const subject of subjects) {
    const snap = await getDocs(query(
      collection(db, "questions"),
      where("subject", "==", subject),
      where("active", "==", true)
    ));

    const pool = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (pool.length < 15) {
      throw new Error(`There are not enough active ${subject} questions yet. At least 15 are required.`);
    }

    questionsBySubject[subject] = shuffle(pool).slice(0, 15);
  }

  // IMPORTANT: flatten only after all four subject blocks are prepared.
  // This guarantees: Subject 1 Q1-Q15, Subject 2 Q1-Q15, etc.
  const questions = subjects.flatMap(subject => questionsBySubject[subject]);

  return {
    examId: makeExamId(),
    expiresAt: Date.now() + 30 * 60 * 1000,
    questions
  };
}

function buildResult(examId, questions, answers, subjects) {
  const cleanAnswers = {};
  Object.entries(answers || {}).forEach(([id, value]) => {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 0 && n <= 3) cleanAnswers[id] = n;
  });

  let correct = 0;
  let unanswered = 0;
  const review = questions.map((q, i) => {
    const selected = Object.prototype.hasOwnProperty.call(cleanAnswers, q.id) ? cleanAnswers[q.id] : null;
    if (selected === null) unanswered++;
    const isCorrect = selected !== null && Number(selected) === Number(q.answer);
    if (isCorrect) correct++;
    return {
      number: i + 1,
      subject: q.subject,
      topic: q.topic || "",
      question: q.question,
      options: Array.isArray(q.options) ? q.options : [],
      selected,
      correct: isCorrect,
      correctAnswer: Number(q.answer),
      explanation: q.explanation || ""
    };
  });

  const total = questions.length;
  const score = correct;
  const percentage = total ? Math.round((score / total) * 100) : 0;
  const sections = subjects.map(subject => {
    const items = review.filter(x => x.subject === subject);
    const sectionCorrect = items.filter(x => x.correct).length;
    const sectionTotal = items.length;
    return {
      subject,
      score: sectionCorrect,
      total: sectionTotal,
      percentage: sectionTotal ? Math.round((sectionCorrect / sectionTotal) * 100) : 0
    };
  });

  return {
    id: examId,
    examName: "JAMB Practice Test",
    submittedAt: new Date().toISOString(),
    score,
    total,
    percentage,
    correct,
    wrong: total - correct - unanswered,
    unanswered,
    sections,
    review
  };
}

export async function submitExam(examId, answers, questions, subjects) {
  const u = await currentUser();
  if (!u) throw new Error("Please sign in before submitting your test.");
  if (!examId || !Array.isArray(questions) || !questions.length) throw new Error("This test session is no longer available.");

  const result = buildResult(examId, questions, answers, subjects || [...new Set(questions.map(q => q.subject))]);
  await setDoc(doc(db, "users", u.uid, "results", examId), result);
  return { result };
}

export async function getAttempt(attemptId) {
  const u = await currentUser();
  if (!u) throw new Error("Please sign in to view this result.");
  const snap = await getDoc(doc(db, "users", u.uid, "results", attemptId));
  if (!snap.exists()) throw new Error("Result not found.");
  return snap.data();
}

export async function loadResults() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  const snap = await getDocs(
    query(collection(db, "users", u.uid, "results"), orderBy("submittedAt", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
