// ========================================
// HEALTHKART - FIREBASE CONFIGURATION
// Project: healthkart-e4e37
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyABZb869NRk_6N_6gahNwnYlFPR7Vss7HM",
  authDomain: "healthkart-e4e37.firebaseapp.com",
  databaseURL: "https://healthkart-e4e37-default-rtdb.firebaseio.com",
  projectId: "healthkart-e4e37",
  storageBucket: "healthkart-e4e37.firebasestorage.app",
  messagingSenderId: "287996998044",
  appId: "1:287996998044:web:35104c8f74a3f7d3331859",
  measurementId: "G-5N73RTLD4K"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore
const db = getFirestore(app);

// Initialize Authentication
const auth = getAuth(app);

// Initialize Analytics safely
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Expose globally for both module & non-module integration
if (typeof window !== "undefined") {
  window.HealthKartFirebase = {
    app,
    db,
    auth,
    analytics,
    firebaseConfig
  };
}

export {
  app,
  db,
  auth,
  analytics,
  firebaseConfig
};