/**
 * firebase-config.js - Cấu hình Google Firebase Firestore Database
 * 
 * HƯỚNG DẪN LẤY CẤU HÌNH MIỄN PHÍ TRONG 2 PHÚT:
 * 1. Mở trình duyệt và truy cập: https://console.firebase.google.com/
 * 2. Đăng nhập tài khoản Google và bấm "Add project" (Thêm dự án) -> Đặt tên (ví dụ: "DangKyCom")
 * 3. Bấm vào menu bên trái: "Build" -> "Firestore Database" -> Bấm "Create database"
 *    - Chọn vị trí server: asia-southeast1 (Singapore) để tốc độ tại Việt Nam nhanh nhất (<50ms).
 *    - Chọn chế độ "Start in test mode" (hoặc Production mode).
 * 4. Bấm vào biểu tượng Bánh răng (Project Settings) ở góc trên bên trái -> Cuộn xuống mục "Your apps"
 *    - Bấm vào biểu tượng Web (</>)
 *    - Đặt tên App (ví dụ: "DangKyCom Web")
 *    - Sao chép toàn bộ object `firebaseConfig` và dán thay thế vào bên dưới.
 */

const FIREBASE_CONFIG = {
    // DÁN THÔNG TIN FIREBASE CONFIG CỦA BẠN VÀO ĐÂY:
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
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
