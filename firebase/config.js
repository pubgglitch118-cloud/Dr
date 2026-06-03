// ============================================================
// Dr. Ruhm Badr - Firebase Configuration
// Replace with your Firebase project's config values.
// Get these from: Firebase Console > Project Settings > General
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCrv63Gpb6eRCjuNUSAZjcSgUWFpHDjVcc",
  authDomain: "clinic-52f6e.firebaseapp.com",
  projectId: "clinic-52f6e",
  storageBucket: "clinic-52f6e.firebasestorage.app",
  messagingSenderId: "631576216692",
  appId: "1:631576216692:web:4008c207acf6cd4c223d21",
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn('Firestore persistence:', err.message);
});
