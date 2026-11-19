/**
 * timeSimulator.js - Quản lý thời gian thực tế hệ thống (Production Mode)
 * Sử dụng 100% thời gian thực tế của thiết bị / trình duyệt, đảm bảo tính chính xác và an toàn cho dữ liệu thật.
 */

// Xóa triệt để các cờ và dữ liệu thời gian giả lập còn sót lại trong bộ nhớ
try {
    localStorage.removeItem("meal_app_simulated_time");
    localStorage.removeItem("meal_app_simulation_active");
} catch (e) {}

const TimeSimulator = {
    // Luôn trả về thời gian thực tế của thiết bị
    now() {
        return new Date();
    },

    // Chế độ giả lập đã bị xóa bỏ hoàn toàn cho môi trường thực tế
    isSimulating() {
        return false;
    },

    // Định dạng chuỗi ngày YYYY-MM-DD
    formatDate(date) {
        const d = date || this.now();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    },

    // Định dạng chuỗi giờ HH:mm:ss
    formatTime(date) {
        const d = date || this.now();
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    },

    // Định dạng ngày giờ chuẩn hiển thị: DD/MM/YYYY HH:mm
    formatDateTimeDisplay(date) {
        if (!date) return "";
        const d = typeof date === "string" ? new Date(date) : date;
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    },

    // Lấy chuỗi ngày hôm nay YYYY-MM-DD
    getTodayString() {
        return this.formatDate(this.now());
    }
};
