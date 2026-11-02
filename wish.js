// Cartinha e bilhetes · Firestore sem login, com identificadores derivados do segredo do sorteio.
// Nenhum nome é gravado no banco: só hashes, desejos e bilhetes.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBNpa80CRf5NmglQlty08pqim8GYalg-N4",
  authDomain: "amigo-secreto-deleu-2026.firebaseapp.com",
  projectId: "amigo-secreto-deleu-2026",
  appId: "1:52152748449:web:89d3d470d7895cfa45a3e0",
});
const db = getFirestore(app);

const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return b64u(new Uint8Array(d));
}
const norm = (name) => String(name || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function ids(secret, name) {
  return {
    eventId: (await sha("event|" + secret)).slice(0, 16),
    wid: (await sha(secret + "|" + norm(name))).slice(0, 22),
  };
}
// sorteios antigos (sem segredo no link) usam o título do evento como segredo
export const secretFor = (payload) => payload.s || ("title:" + norm(payload.ev?.title || "amigo secreto"));

const wishRef = (eventId, wid) => doc(db, "events", eventId, "wishes", wid);
const notesCol = (eventId, wid) => collection(db, "events", eventId, "notes", wid, "items");

export async function getWish(eventId, wid) { const s = await getDoc(wishRef(eventId, wid)); return s.exists() ? s.data() : null; }
export function watchWish(eventId, wid, cb) { return onSnapshot(wishRef(eventId, wid), (s) => cb(s.exists() ? s.data() : null), (e) => cb(null, e)); }
export async function saveWish(eventId, wid, data) {
  const wants = (data.wants || []).filter((w) => w.text?.trim()).slice(0, 3).map((w) => ({ cat: String(w.cat || "").slice(0, 20), text: w.text.trim().slice(0, 120) }));
  await setDoc(wishRef(eventId, wid), { wants, sizes: (data.sizes || "").trim().slice(0, 200), avoid: (data.avoid || "").trim().slice(0, 200), tip: (data.tip || "").trim().slice(0, 200), updatedAt: serverTimestamp() });
}
export function watchNotes(eventId, wid, cb) {
  return onSnapshot(query(notesCol(eventId, wid), orderBy("at", "asc")), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => cb([], e));
}
export async function sendNote(eventId, wid, from, text) {
  await addDoc(notesCol(eventId, wid), { from, text: text.trim().slice(0, 300), at: serverTimestamp() });
}

window.Wish = { ids, secretFor, getWish, watchWish, saveWish, watchNotes, sendNote };
window.dispatchEvent(new Event("wish-ready"));
