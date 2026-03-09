import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'

const firebaseConfig = {
  apiKey:            import.meta.env['VITE_FIREBASE_API_KEY'],
  authDomain:        import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId:         import.meta.env['VITE_FIREBASE_PROJECT_ID'],
  storageBucket:     import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
  appId:             import.meta.env['VITE_FIREBASE_APP_ID'],
} as const

// Avoid re-initializing in HMR
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!

export const auth = getAuth(app)

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

// Returns fresh Firebase JWT — attach as Authorization: Bearer {token}
export async function getIdToken(): Promise<string | null> {
  return auth.currentUser?.getIdToken() ?? null
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
