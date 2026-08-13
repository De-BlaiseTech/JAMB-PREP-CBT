import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// Public Firebase web configuration. This is safe to expose in a web app.
const firebaseConfig = {
  apiKey: "AIzaSyA4S1twyswdKKFu5C1QYVObhu1e4QaPIhs",
  authDomain: "jamb-prep-cbt.firebaseapp.com",
  projectId: "jamb-prep-cbt",
  storageBucket: "jamb-prep-cbt.firebasestorage.app",
  messagingSenderId: "519735246364",
  appId: "1:519735246364:web:5772de163cf045ab9ae9d9"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
