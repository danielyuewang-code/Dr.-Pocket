import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:       import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:   import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:    import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export const loginUser    = (email, password) => signInWithEmailAndPassword(auth, email, password)
export const registerUser = (email, password) => createUserWithEmailAndPassword(auth, email, password)
export const logoutUser   = () => signOut(auth)
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb)

// ─── Firestore helpers ────────────────────────────────────────────────────────
export const getUserDoc = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

export const saveProfile = async (uid, profile) => {
  await setDoc(doc(db, 'users', uid), { profile }, { merge: true })
}

export const saveHistory = async (uid, history) => {
  await setDoc(doc(db, 'users', uid), { history }, { merge: true })
}

export const loadUserData = async (uid) => {
  const data = await getUserDoc(uid)
  return {
    profile: data?.profile || {
      dob: '', sex: '', height: '', weight: '',
      conditions: '', medications: '', allergies: '',
      activityLevel: '', smoking: '', familyHistory: '',
    },
    history: data?.history || [],
  }
}
