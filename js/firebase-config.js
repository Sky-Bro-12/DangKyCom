/**
 * firebase-config.js - Cấu hình Google Firebase Firestore Database (Online)
 * Dự án: dangkycom-f7ebe (Cộng đoàn Dự tu Biên Hòa)
 */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBnto8gvDBgSTQjXeWZ0PPsVegfYWZQ__c",
    authDomain: "dangkycom-f7ebe.firebaseapp.com",
    projectId: "dangkycom-f7ebe",
    storageBucket: "dangkycom-f7ebe.firebasestorage.app",
    messagingSenderId: "552516728576",
    appId: "1:552516728576:web:ef86a5f0243892823a25e5",
    measurementId: "G-THRKJV6VNL"
};

/**
 * Kiểm tra xem Firebase đã được điền thông tin thật hay chưa
 */
function isFirebaseConfigured() {
    return typeof FIREBASE_CONFIG !== "undefined" &&
           FIREBASE_CONFIG.apiKey &&
           FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY" &&
           FIREBASE_CONFIG.projectId &&
           FIREBASE_CONFIG.projectId !== "YOUR_PROJECT_ID";
}
