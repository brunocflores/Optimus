import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCMbHBEhVW28JYF7vGIG4tRlylfR4E-WME",
  authDomain: "optimuspy-54238.firebaseapp.com",
  projectId: "optimuspy-54238",
  storageBucket: "optimuspy-54238.firebasestorage.app",
  messagingSenderId: "378759292249",
  appId: "1:378759292249:web:28c63549fbfa96da705848",
  measurementId: "G-JBLWYQ3F89"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
