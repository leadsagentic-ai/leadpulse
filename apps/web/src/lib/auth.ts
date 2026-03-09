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
  apiKey:            import.meta.env['VITE_FIREBASE_API_KEY'] as string,
  authDomain:        import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string,
  projectId:         import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string,
  storageBucket:     import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'] as string,
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] as string,
  appId:             import.meta.env['VITE_FIREBASE_APP_ID'] as string,
}

// Prevent duplicate app init during HMR
const firebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0]!

export const auth = getAuth(firebaseApp)

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

// Returns a fresh JWT to attach to API requests
export async function getIdToken(): Promise<string | null> {
  return auth.currentUser?.getIdToken() ?? null
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export { onAuthStateChanged, type User }
