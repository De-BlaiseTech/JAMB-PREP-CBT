import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const createBtn=document.getElementById("create");
const backBtn=document.getElementById("backToLogin");
const msg=document.getElementById("msg");
const friendlyError=e=>{
  const map={
    'auth/invalid-email':'Please enter a valid email address.',
    'auth/email-already-in-use':'An account already exists with this email address.',
    'auth/weak-password':'Choose a stronger password with at least 6 characters.',
    'auth/network-request-failed':'Please check your internet connection and try again.'
  };
  return map[e?.code]||'Something went wrong. Please try again.';
};
backBtn.onclick=()=>{window.location.href="index.html"};
createBtn.onclick=async()=>{
  msg.textContent="";
  const name=document.getElementById("name").value.trim();
  const regno=document.getElementById("regno").value.trim();
  const email=document.getElementById("email").value.trim();
  const password=document.getElementById("password").value;
  if(!name||!email||!password){msg.textContent="Please fill in all required fields.";return}
  if(password.length<6){msg.textContent="Password must be at least 6 characters.";return}
  try{
    createBtn.disabled=true;createBtn.textContent="Creating Account…";
    const res=await createUserWithEmailAndPassword(auth,email,password);
    await updateProfile(res.user,{displayName:name});
    await setDoc(doc(db,"users",res.user.uid),{name,regNo:regno,email,role:"student",createdAt:new Date().toISOString(),emailVerified:false});
    const actionCodeSettings={url:new URL("index.html",window.location.href).href,handleCodeInApp:false};
    await sendEmailVerification(res.user,actionCodeSettings);
    await signOut(auth);
    createBtn.disabled=false;createBtn.textContent="Register Account";
    msg.style.color="var(--success)";
    msg.textContent="Account created. A verification link has been sent to your email. Please verify your email before signing in.";
  }catch(err){
    createBtn.disabled=false;createBtn.textContent="Register Account";
    msg.textContent=friendlyError(err);
  }
};