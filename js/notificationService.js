/**
 * notificationService.js - Dịch vụ thông báo và nhắc nhở đăng ký cơm
 * Hỗ trợ:
 * 1. Web Notifications API (Thông báo đẩy trên trình duyệt Desktop/Mobile)
 * 2. Âm thanh chuông báo (Web Audio API không cần file ngoài)
 * 3. Tích hợp Telegram Bot API & Webhook (Zalo/Discord/Lark)
 * 4. Quản lý mẫu tin nhắn nhắc nhở cho Zalo/Telegram
 */

const NotificationService = {
    STORAGE_CONFIG_KEY: "meal_reminder_bot_config",

    // Kiểm tra trình duyệt có hỗ trợ Web Notification không
    isNotificationSupported() {
        return "Notification" in window;
    },

    // Lấy quyền hiện tại: "default" | "granted" | "denied"
    getPermission() {
        if (!this.isNotificationSupported()) return "unsupported";
        return Notification.permission;
    },

    // Yêu cầu quyền thông báo từ người dùng
    async requestPermission() {
        if (!this.isNotificationSupported()) {
            return "unsupported";
        }
        try {
            const perm = await Notification.requestPermission();
            return perm;
        } catch (e) {
            console.error("Lỗi khi yêu cầu cấp quyền thông báo:", e);
            return "denied";
        }
    },

    // Bắn thông báo đẩy trên trình duyệt
    showBrowserNotification(title, body, options = {}) {
        if (!this.isNotificationSupported() || Notification.permission !== "granted") {
            return false;
        }

        try {
            const notif = new Notification(title, {
                body: body,
                icon: "assets/icon-192.png",
                badge: "assets/favicon-32x32.png",
                tag: options.tag || "meal-reminder",
                renotify: true,
                ...options
            });

            notif.onclick = () => {
                window.focus();
                if (options.url) {
                    window.location.hash = options.url;
                }
                notif.close();
            };

            // Kèm âm thanh chuông báo nhẹ
            if (options.sound !== false) {
                this.playReminderChime();
            }

            return true;
        } catch (e) {
            console.warn("Không thể hiển thị Web Notification:", e);
            return false;
        }
    },

    // Phát chuông báo nhẹ bằng Web Audio API (không cần tải file audio bên ngoài)
    playReminderChime() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const now = ctx.currentTime;

            // Nốt 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(587.33, now); // D5
            gain1.gain.setValueAtTime(0.15, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.3);

            // Nốt 2 cao hơn
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(880, now + 0.15); // A5
            gain2.gain.setValueAtTime(0.2, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.15);
            osc2.stop(now + 0.5);
        } catch (e) {
            // Trình duyệt có thể chặn autoplay nếu chưa có tương tác
        }
    },

    // ==========================================
    // CẤU HÌNH NHÓM ZALO & WEBHOOK
    // ==========================================
    getZaloConfig() {
        try {
            const raw = localStorage.getItem(this.STORAGE_CONFIG_KEY);
            return raw ? JSON.parse(raw) : {
                zaloGroupUrl: "",
                webhookUrl: ""
            };
        } catch (e) {
            return { zaloGroupUrl: "", webhookUrl: "" };
        }
    },

    saveZaloConfig(config) {
        localStorage.setItem(this.STORAGE_CONFIG_KEY, JSON.stringify(config));
    },

    // Tương thích ngược
    getBotConfig() {
        return this.getZaloConfig();
    },

    saveBotConfig(config) {
        this.saveZaloConfig(config);
    },

    // Gửi nhắc nhở tới nhóm Zalo (Sao chép tin nhắn + Mở nhóm Zalo / Zalo Web để dán ngay)
    async sendZaloReminder(messageText) {
        const config = this.getZaloConfig();

        // 1. Luôn sao chép nội dung tin nhắn nhắc nhở vào bộ nhớ tạm
        await this.copyToClipboard(messageText);

        // 2. Nếu có cấu hình Webhook URL, gửi thêm qua webhook
        if (config.webhookUrl) {
            this.sendWebhookMessage(messageText).catch(e => console.warn("Lỗi gửi webhook Zalo:", e));
        }

        // 3. Mở Zalo nhóm đích hoặc Zalo Web
        const targetUrl = config.zaloGroupUrl && config.zaloGroupUrl.trim()
            ? config.zaloGroupUrl.trim()
            : "https://chat.zalo.me/";

        window.open(targetUrl, "_blank");

        return {
            success: true,
            openedUrl: targetUrl,
            message: config.zaloGroupUrl
                ? "Đã sao chép tin nhắn nhắc nhở và mở nhóm Zalo! Hãy nhấn Ctrl + V để dán và gửi ngay."
                : "Đã sao chép tin nhắn và mở Zalo Web! Bạn hãy chọn nhóm cần nhắc rồi nhấn Ctrl + V để gửi."
        };
    },

    // Gửi tin nhắn qua Webhook tùy chọn (Zalo OA Webhook, Lark, Discord...)
    async sendWebhookMessage(messageText) {
        const config = this.getZaloConfig();
        if (!config.webhookUrl) {
            return {
                success: false,
                message: "Vui lòng cấu hình Webhook URL trước khi gửi!"
            };
        }

        try {
            const response = await fetch(config.webhookUrl.trim(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: messageText,
                    text: messageText
                })
            });

            if (response.ok) {
                return { success: true, message: "Đã gửi thông báo qua Webhook thành công!" };
            } else {
                return { success: false, message: `Webhook trả về mã lỗi: ${response.status}` };
            }
        } catch (error) {
            return { success: false, message: `Lỗi mạng khi gọi Webhook: ${error.message}` };
        }
    },

    // Sao chép tin nhắn vào Clipboard
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback cho trình duyệt cũ
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                const successful = document.execCommand("copy");
                document.body.removeChild(textarea);
                return successful;
            }
        } catch (e) {
            console.error("Không thể sao chép vào bộ nhớ tạm:", e);
            return false;
        }
    }
};

