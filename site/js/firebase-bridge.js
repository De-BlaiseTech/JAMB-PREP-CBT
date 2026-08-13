import { auth, db, functions } from "./firebase.js";
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
  getDocs,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

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

async function call(name, data) {
  return (await httpsCallable(functions, name)(data)).data;
}

export async function startExam(subjects) {
  return call("startExam", { subjects });
}

export async function submitExam(examId, answers) {
  return call("submitExam", { examId, answers });
}

export async function getAttempt(attemptId) {
  return (await call("getAttempt", { attemptId })).result;
}

export async function loadResults() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  const snap = await getDocs(
    query(collection(db, "users", u.uid, "results"), orderBy("submittedAt", "desc"))
  );
  return snap.docs.map(d => d.data());
}
