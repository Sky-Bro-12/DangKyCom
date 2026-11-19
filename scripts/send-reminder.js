/**
 * scripts/send-reminder.js
 * Script gửi thông báo nhắc nhở tự động (Chạy trên Node.js độc lập hoặc qua GitHub Actions)
 * Không phụ thuộc vào npm package bên ngoài - Sử dụng HTTPS có sẵn của Node.js.
 */

const https = require("https");
const url = require("url");

// Cấu hình các bữa ăn và hạn chốt
const MEALS = {
    breakfast: {
        name: "Bữa sáng",
        mealTime: "06:30",
        deadline: "03:30"
    },
    lunch: {
        name: "Bữa trưa",
        mealTime: "11:00",
        deadline: "08:00"
    },
    dinner: {
        name: "Bữa chiều",
        mealTime: "17:00",
        deadline: "14:00"
    }
};

// Xác định bữa ăn cần nhắc nhở
function getTargetMeal() {
    const args = process.argv.slice(2);
    const mealArgIndex = args.indexOf("--meal");
    if (mealArgIndex !== -1 && args[mealArgIndex + 1]) {
        const key = args[mealArgIndex + 1].toLowerCase();
        if (MEALS[key]) return MEALS[key];
    }

    // Tự động đoán theo giờ hiện tại (Giờ UTC hoặc Local)
    const now = new Date();
    // Chuyển sang giờ Việt Nam (UTC+7)
    const utcHours = now.getUTCHours();
    const vnHours = (utcHours + 7) % 24;

    if (vnHours >= 0 && vnHours < 4) {
        return MEALS.breakfast;
    } else if (vnHours >= 4 && vnHours < 9) {
        return MEALS.lunch;
    } else {
        return MEALS.dinner;
    }
}

// Định dạng ngày hôm nay (theo giờ VN)
function getTodayString() {
    const now = new Date();
    const vnDate = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const day = String(vnDate.getUTCDate()).padStart(2, "0");
    const month = String(vnDate.getUTCMonth() + 1).padStart(2, "0");
    const year = vnDate.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

// Tạo nội dung tin nhắn
function buildReminderMessage(meal) {
    const appUrl = process.env.APP_URL || "https://sky-bro-12.github.io/DangKyCom/";
    const today = getTodayString();

    return `🍚 <b>[NHẮC NHỞ ĐĂNG KÝ CƠM]</b> 🍚\n` +
           `📅 <b>Ngày:</b> ${today}\n` +
           `🍽️ <b>Bữa ăn:</b> ${meal.name.toUpperCase()} (Giờ ăn: ${meal.mealTime})\n` +
           `⏰ <b>Hạn chốt đăng ký:</b> <code>${meal.deadline}</code>\n\n` +
           `⚠️ <i>Chỉ còn 15-20 phút trước khi hệ thống tự động khóa đăng ký!</i>\n` +
           `👉 Anh em nào chưa chọn cơm vui lòng bấm vào link dưới đây để hoàn tất:\n` +
           `🔗 <a href="${appUrl}">${appUrl}</a>`;
}

// Gửi tin nhắn qua Telegram
function sendTelegramMessage(token, chatId, text) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: "HTML",
            disable_web_page_preview: false
        });

        const options = {
            hostname: "api.telegram.org",
            port: 443,
            path: `/bot${token}/sendMessage`,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                try {
                    const json = JSON.parse(body);
                    if (json.ok) {
                        resolve(json);
                    } else {
                        reject(new Error(`Telegram API Error: ${json.description || body}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on("error", reject);
        req.write(payload);
        req.end();
    });
}

// Gửi tin nhắn qua Webhook tùy chọn (Discord, Lark, Zalo OA...)
function sendWebhookMessage(webhookUrl, text) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new url.URL(webhookUrl);
        const payload = JSON.stringify({
            content: text,
            text: text
        });

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(new Error(`Webhook trả về HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on("error", reject);
        req.write(payload);
        req.end();
    });
}

// Hàm thực thi chính
async function main() {
    const meal = getTargetMeal();
    const message = buildReminderMessage(meal);

    console.log("=========================================");
    console.log("🍚 TIẾN TRÌNH NHẮC NHỞ ĐĂNG KÝ CƠM TỰ ĐỘNG");
    console.log(`Bữa ăn mục tiêu: ${meal.name} (Khóa lúc ${meal.deadline})`);
    console.log("-----------------------------------------");
    console.log(message.replace(/<[^>]+>/g, "")); // Bản in text sạch
    console.log("=========================================");

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    const webhookUrl = process.env.WEBHOOK_URL;

    let sent = false;

    if (telegramToken && telegramChatId) {
        try {
            console.log("Đang gửi tin nhắn qua Telegram Bot...");
            await sendTelegramMessage(telegramToken, telegramChatId, message);
            console.log("✅ Đã gửi tin nhắn nhắc nhở qua Telegram thành công!");
            sent = true;
        } catch (e) {
            console.error("❌ Lỗi gửi Telegram:", e.message);
        }
    }

    if (webhookUrl) {
        try {
            console.log("Đang gửi tin nhắn qua Webhook...");
            await sendWebhookMessage(webhookUrl, message);
            console.log("✅ Đã gửi tin nhắn qua Webhook thành công!");
            sent = true;
        } catch (e) {
            console.error("❌ Lỗi gửi Webhook:", e.message);
        }
    }

    if (!sent) {
        console.log("ℹ️ Gợi ý cấu hình gửi tự động:");
        console.log("Để hệ thống tự động bắn tin nhắn vào nhóm chat, bạn hãy thêm vào GitHub Secrets:");
        console.log("1. TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID (Cho nhóm Telegram)");
        console.log("HOẶC 2. WEBHOOK_URL (Cho kênh Discord / Lark / Zalo OA Webhook)");
    }
}

main().catch(err => {
    console.error("Lỗi không mong muốn:", err);
    process.exit(1);
});

