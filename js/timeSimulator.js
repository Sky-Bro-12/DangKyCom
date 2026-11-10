/**
 * timeSimulator.js - Quản lý và giả lập thời gian hệ thống
 * Phục vụ mục đích kiểm thử các mốc hạn chót (03:30, 08:00, 14:00) mọi lúc.
 */

const TimeSimulator = {
    // Lấy thời gian hiện tại (thực tế hoặc giả lập)
    now() {
        const isSimulated = localStorage.getItem(CONFIG.STORAGE_KEYS.SIMULATION_ACTIVE) === "true";
        if (isSimulated) {
            const savedIso = localStorage.getItem(CONFIG.STORAGE_KEYS.SIMULATED_TIME);
            if (savedIso) {
                return new Date(savedIso);
            }
        }
        return new Date();
    },

    // Kiểm tra có đang bật chế độ giả lập thời gian không
    isSimulating() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.SIMULATION_ACTIVE) === "true";
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

    // Định dạng ngày giờ chuẩn hiển thị: DD/MM/YYYY HH:mm:ss
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
    },

    // Thiết lập thời gian giả lập
    setSimulatedTime(dateTime) {
        const d = typeof dateTime === "string" ? new Date(dateTime) : dateTime;
        localStorage.setItem(CONFIG.STORAGE_KEYS.SIMULATED_TIME, d.toISOString());
        localStorage.setItem(CONFIG.STORAGE_KEYS.SIMULATION_ACTIVE, "true");
        this.triggerChange();
    },

    // Đặt giờ theo mốc cụ thể trong ngày hôm nay (giờ, phút)
    setTodayPreset(hours, minutes) {
        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        this.setSimulatedTime(d);
    },

    // Trở về giờ thực của thiết bị
    resetToRealTime() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.SIMULATION_ACTIVE);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.SIMULATED_TIME);
        this.triggerChange();
    },

    // Bắn sự kiện khi thời gian thay đổi để các màn hình tự làm mới
    triggerChange() {
        const event = new CustomEvent("meal_time_changed", {
            detail: { now: this.now(), isSimulated: this.isSimulating() }
        });
        window.dispatchEvent(event);
    }
};
