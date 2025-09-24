// Replace the below config with your Firebase project settings from the Firebase Console
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBXq1WuHg8SNfLs0ft7to35-Wp8KhcKgVw",
  authDomain: "maco-a16fb.firebaseapp.com",
  projectId: "maco-a16fb",
  storageBucket: "maco-a16fb.firebasestorage.app",
  messagingSenderId: "14843865865",
  appId: "1:14843865865:web:a42f60266e5f471dce81d8",
  measurementId: "G-H1FZSW8L3K"
};



let app, db;
try {
  console.log('[Firebase] Initializing Firebase app...');
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('[Firebase] Firebase initialized successfully.');
} catch (e) {
  console.error('[Firebase] Error initializing Firebase:', e);
}

export { db };
