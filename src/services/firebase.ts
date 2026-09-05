import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyA3Jqq4fQBG4FXKO0Cn9UWecrqkDhMGjqo",
  authDomain: "acl-inventory-mange-final.firebaseapp.com",
  projectId: "acl-inventory-mange-final",
  storageBucket: "acl-inventory-mange-final.firebasestorage.app",
  messagingSenderId: "1079175783095",
  appId: "1:1079175783095:web:82d847f28100fdac0ee332",
  measurementId: "G-50YK708WR9"
};

// Initialize Firebase App singleton safely
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore singleton
export const firestore = getFirestore(firebaseApp);
