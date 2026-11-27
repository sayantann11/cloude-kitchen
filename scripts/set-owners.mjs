// Sync Firestore owners/{uid} with admin-owners.txt. Runs in GitHub Actions with the
// FIREBASE_SERVICE_ACCOUNT secret. Prints only UIDs (never emails): the repo is public.
import fs from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: cert(JSON.parse(process.env.SA_JSON)) });
const auth = getAuth();
const db = getFirestore();
const wanted = fs.readFileSync(process.env.OWNERS_FILE, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));

const isEmailLogin = u => u.providerData.some(p => p.providerId === 'password');
const ok = [];
for (const uid of wanted) {
  try {
    const u = await auth.getUser(uid);
    if (isEmailLogin(u)) { ok.push(uid); console.log(`::notice::${uid} is a valid email login`); }
    else console.log(`::warning::${uid} is not an email/password login, skipped`);
  } catch { console.log(`::warning::UID ${uid} not found in Authentication`); }
}
if (!ok.length) {
  const emailUsers = (await auth.listUsers(1000)).users.filter(isEmailLogin);
  if (emailUsers.length === 1) {
    ok.push(emailUsers[0].uid);
    console.log(`::notice::Using the only email login in the project: ${emailUsers[0].uid} (update admin-owners.txt to this UID)`);
  } else {
    console.log(`::error::No valid owner UID. Email logins in this project: ${emailUsers.map(u => u.uid).join(', ') || 'none'}`);
    process.exit(1);
  }
}
for (const d of (await db.collection('owners').get()).docs) {
  if (!ok.includes(d.id)) { await d.ref.delete(); console.log(`::notice::Removed old owner ${d.id}`); }
}
for (const uid of ok) await db.collection('owners').doc(uid).set({ name: 'Owner', updatedAt: Date.now() }, { merge: true });
console.log(`::notice::Owners now: ${ok.join(', ')}`);
