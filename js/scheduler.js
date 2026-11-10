/**
 * scheduler.js - Tiến trình tự động quét và chốt sổ thành viên quá hạn
 * (Tương đương NotRegisteredBackgroundService trong ASP.NET Core)
 */

const Scheduler = {
    timerId: null,

    // Khởi chạy tiến trình
    start(intervalSeconds = 30) {
        if (this.timerId) {
            clearInterval(this.timerId);
        }

        // Chạy lần đầu ngay lập tức
        this.checkUnregisteredMembers();

        // Lặp lại định kỳ
        this.timerId = setInterval(() => {
            this.checkUnregisteredMembers();
        }, intervalSeconds * 1000);

        // Lắng nghe khi người dùng đổi giờ giả lập thì kích hoạt quét ngay
        window.addEventListener("meal_time_changed", () => {
            this.checkUnregisteredMembers();
        });

        console.log("Scheduler kiểm tra đăng ký quá hạn đã được kích hoạt.");
    },

    stop() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    },

    // Kiểm tra và tự động gán trạng thái Chưa đăng ký - Quá hạn
    checkUnregisteredMembers() {
        const todayStr = TimeSimulator.getTodayString();
        const todayDate = new Date(todayStr + "T00:00:00");
        const now = TimeSimulator.now();

        const mealDeadlines = [
            CONFIG.MEAL_TYPES.BREAKFAST,
            CONFIG.MEAL_TYPES.LUNCH,
            CONFIG.MEAL_TYPES.DINNER
        ];

        const activeMembers = DB.getMembers().filter(m => m.isActive);
        if (activeMembers.length === 0) return;

        let allRegistrations = DB.getRegistrations();
        let totalMarked = 0;

        mealDeadlines.forEach(meal => {
            const deadlineDate = new Date(todayDate);
            deadlineDate.setHours(meal.deadlineHour, meal.deadlineMinute, 0, 0);

            // Chưa đến giờ khóa đăng ký thì bỏ qua
            if (now < deadlineDate) {
                return;
            }

            // Lấy danh sách thành viên đã có đăng ký bữa này trong ngày
            const registeredMemberIds = allRegistrations
                .filter(r => r.mealDate === todayStr && r.mealType === meal.id)
                .map(r => r.memberId);

            // Tìm những thành viên đang hoạt động nhưng chưa có bất kỳ đăng ký nào
            const missingMembers = activeMembers.filter(m => !registeredMemberIds.includes(m.id));

            if (missingMembers.length > 0) {
                let maxId = allRegistrations.length > 0 ?
                    Math.max(...allRegistrations.map(r => r.id || 0)) : 0;

                missingMembers.forEach(member => {
                    maxId++;
                    allRegistrations.push({
                        id: maxId,
                        memberId: member.id,
                        mealDate: todayStr,
                        mealType: meal.id,
                        status: CONFIG.MEAL_STATUS.NOT_REGISTERED.id,
                        registeredAt: null,
                        lateReason: null
                    });
                    totalMarked++;
                });

                console.log(
                    `[Scheduler] Đã tự động chốt ${missingMembers.length} thành viên chưa đăng ký ${meal.name}.`
                );
            }
        });

        if (totalMarked > 0) {
            DB.saveRegistrations(allRegistrations);
            // Phát sự kiện để cập nhật lại các bảng nếu đang mở
            window.dispatchEvent(new CustomEvent("meal_registrations_updated"));
        }
    }
};

// Tự động kích hoạt khi tải trang
Scheduler.start();
