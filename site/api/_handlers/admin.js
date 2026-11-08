'use strict';
const { requireUser, db, getAdmin } = require('../_lib/firebaseAdmin');
const send=(res,status,body)=>res.status(status).setHeader('Content-Type','application/json').send(JSON.stringify(body));
const clean=(v,n=5000)=>String(v??'').trim().slice(0,n);
function adminAllowed(token){
  const ids=(process.env.ADMIN_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  return ids.includes(token.uid);
}
function validateQuestion(q){
  const subject=clean(q.subject,100), topic=clean(q.topic,160), question=clean(q.question,5000);
  const options=Array.isArray(q.options)?q.options.map(x=>clean(x,1000)):[];
  const answer=Number(q.answer);
  if(!subject||!question||options.length!==4||options.some(x=>!x)||!Number.isInteger(answer)||answer<0||answer>3)
    throw Object.assign(new Error('Enter a subject, question, four options and a valid correct answer.'),{statusCode:400});
  return {subject,topic,question,options,answer,explanation:clean(q.explanation,5000),active:q.active!==false};
}
module.exports=async(req,res)=>{
 if(!['GET','POST','DELETE'].includes(req.method)) return send(res,405,{error:'Method not allowed.'});
 try{
  const token=await requireUser(req);
  if(!adminAllowed(token)) return send(res,403,{error:'Administrator access is required.'});
  const action=clean(req.query?.action||req.body?.action,40);
  const store=db();
  if(req.method==='GET' && action==='access') return send(res,200,{isAdmin:true});
  if(req.method==='GET' && action==='questions'){
   // Page by document ID so records without a subject field are not silently
   // excluded by orderBy('subject'), and the admin can retrieve the full bank.
   const collection=store.collection('questions');
   const cursor=clean(req.query?.cursor,150);
   let query=collection.orderBy(getAdmin().firestore.FieldPath.documentId()).limit(500);
   if(cursor){
    const cursorDoc=await collection.doc(cursor).get();
    if(cursorDoc.exists) query=query.startAfter(cursorDoc);
   }
   const snap=await query.get();
   const last=snap.docs[snap.docs.length-1];
   return send(res,200,{questions:snap.docs.map(d=>({id:d.id,...d.data()})),nextCursor:snap.size===500&&last?last.id:null});
  }
  if(req.method==='GET' && action==='students'){
   const snap=await store.collection('users').orderBy('createdAt','desc').limit(500).get();
   const students=await Promise.all(snap.docs.map(async d=>{
    const x=d.data()||{};
    const [results,starts]=await Promise.all([d.ref.collection('results').count().get(),d.ref.collection('mockStarts').count().get()]);
    return {uid:d.id,name:x.name||'',email:x.email||'',regNo:x.regNo||'',role:x.role||'student',createdAt:x.createdAt||'',subscriptionCredits:Number(x.subscriptionCredits||0),subscriptionStatus:x.subscriptionStatus||'free',freePracticeUsed:x.freePracticeUsed===true,testsCompleted:results.data().count||0,mocksStarted:starts.data().count||0};
   }));
   return send(res,200,{students});
  }
  if(req.method==='POST' && action==='bulk-save-questions'){
   const items=req.body?.questions;
   if(!Array.isArray(items)||!items.length) return send(res,400,{error:'Provide at least one question.'});
   if(items.length>450) return send(res,400,{error:'A maximum of 450 questions can be imported per batch.'});
   const batch=store.batch(), now=new Date().toISOString();
   for(const item of items){const data=validateQuestion(item||{});const ref=store.collection('questions').doc();batch.set(ref,{...data,createdAt:now,updatedAt:now});}
   await batch.commit();
   return send(res,200,{success:true,saved:items.length});
  }
  if(req.method==='POST' && action==='save-question'){
   const data=validateQuestion(req.body||{});
   const id=clean(req.body?.id,150);
   const ref=id?store.collection('questions').doc(id):store.collection('questions').doc();
   const existing=id?await ref.get():null;
   const now=new Date().toISOString();
   await ref.set({...data,createdAt:existing?.exists?(existing.data().createdAt||now):now,updatedAt:now},{merge:false});
   return send(res,200,{success:true,id:ref.id});
  }
  if(req.method==='DELETE' && action==='delete-question'){
   const id=clean(req.query?.id,150);
   if(!id||id.includes('/')) return send(res,400,{error:'A valid question ID is required.'});
   await store.collection('questions').doc(id).delete();
   return send(res,200,{success:true});
  }
  return send(res,400,{error:'Unknown admin action.'});
 }catch(e){return send(res,e.statusCode||500,{error:e.message||'Unable to complete admin request.'});}
};
