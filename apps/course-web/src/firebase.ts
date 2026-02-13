import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyB4bTEnUjX4-GIMDhm5NaQAzN19FJW0ObI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "hfp-recht.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "hfp-recht",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "hfp-recht.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "481715405909",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:481715405909:web:40d47989e723af171a80dc"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(
  app,
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION ?? "europe-west6"
);
export const storage = getStorage(app);

const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true";

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
