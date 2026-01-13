// Firebase configuration - replace with your project's values
// Uses the compat libraries via CDN; this file assumes those scripts are loaded first.
const firebaseConfig = {
   apiKey: "AIzaSyCfUJmL3qgZGuvpNzOo34nQ2KmZ0nRllvA",
  authDomain: "school-716af.firebaseapp.com",
  projectId: "school-716af",
  storageBucket: "school-716af.firebasestorage.app",
  messagingSenderId: "502656162620",
  appId: "1:502656162620:web:85a1789189dd5b488d1c39"
};

if (!window.firebase || !firebase.apps) {
  console.error('Firebase SDK not loaded. Make sure you included the Firebase CDN scripts.');
}

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Helper to export in non-module environment
window._firebase = { auth, db };
