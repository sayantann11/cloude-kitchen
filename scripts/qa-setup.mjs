// Live admin QA, step 1 (GitHub Actions only). Uses the FIREBASE_SERVICE_ACCOUNT secret.
// - Saves a snapshot of the live menu + settings so cleanup can put them back exactly.
// - Makes a temporary password-less test admin (uid "qa-bot-owner") and hands the tests a sign-in token.
// Nothing here touches the real owner's account.
import fs from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const QA_UID = 'qa-bot-owner';
initializeApp({ credential: cert(JSON.parse(process.env.SA_JSON)) });
const db = getFirestore();

const snap = {};
for (const id of ['menu', 'settings']) {
  const d = await db.doc(`public/${id}`).get();
  snap[id] = d.exists ? d.data() : null;
}
fs.writeFileSync(process.env.SNAPSHOT_FILE, JSON.stringify(snap));
await db.doc(`owners/${QA_UID}`).set({ name: 'QA bot (temporary)', createdAt: Date.now() });
const token = await getAuth().createCustomToken(QA_UID);
console.log(`::add-mask::${token}`);
fs.appendFileSync(process.env.GITHUB_ENV, `QA_TOKEN=${token}\n`);
console.log(`::notice::QA admin ready. Snapshot saved (menu ${snap.menu ? 'exists' : 'not created yet'}, settings ${snap.settings ? 'exists' : 'not created yet'}).`);
