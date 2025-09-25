// src/firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBFFQ_bh1Mr-qVVnUJ9d9N8yD35wccQnqA",
  authDomain: "nippo-4cb37.firebaseapp.com",
  projectId: "nippo-4cb37",
  storageBucket: "nippo-4cb37.firebasestorage.app",
  messagingSenderId: "409179126653",
  appId: "1:409179126653:web:7574eee39a0618487b6a14"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// 各サービスを取得
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
