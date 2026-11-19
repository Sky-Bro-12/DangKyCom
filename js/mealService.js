/**
 * mealService.js - Nghiệp vụ đăng ký cơm của Thành viên
 */

const MealService = {
    // Lấy thông tin đăng ký của thành viên trong ngày
    getMemberRegistrationsForDate(memberId, dateStr) {
        const registrations = DB.getRegistrations();
        return registrations.filter(r =>
            r.memberId === Number(memberId) &&
            r.mealDate === dateStr
        );
    },

    // Kiểm tra thời hạn đăng ký của một bữa ăn cụ thể
    // dateStr: "YYYY-MM-DD", mealTypeId: 0, 1, 2
    checkMealDeadline(dateStr, mealTypeId) {
        const mealInfo = getMealTypeInfo(mealTypeId);
        const now = TimeSimulator.now();

        const selectedDate = new Date(dateStr + "T00:00:00");
        const todayStr = TimeSimulator.getTodayString();
        const todayDate = new Date(todayStr + "T00:00:00");

        // Không cho phép đăng ký cho ngày trong quá khứ
        if (selectedDate < todayDate) {
            return {
                isExpired: true,
                message: "Không thể đăng ký cho ngày đã qua!"
            };
        }

        // Nếu là ngày tương lai thì vẫn còn hạn
        if (selectedDate > todayDate) {
            return {
                isExpired: false,
                deadlineText: `Khóa lúc ${mealInfo.deadline} ngày ${TimeSimulator.formatDateTimeDisplay(selectedDate).split(" ")[0]}`
            };
        }

        // Nếu là ngày hôm nay: Kiểm tra theo giờ chốt
        const deadlineDate = new Date(todayDate);
        deadlineDate.setHours(mealInfo.deadlineHour, mealInfo.deadlineMinute, 0, 0);

        const isExpired = now >= deadlineDate;

        return {
            isExpired,
            deadlineDate,
            deadlineText: `Khóa lúc ${mealInfo.deadline}`,
            message: isExpired ? `Đã hết hạn đăng ký ${mealInfo.name} (Khóa lúc ${mealInfo.deadline})!` : null
        };
    },

    // Lấy danh sách các thông báo nhắc nhở thành viên
    getReminders(memberId, dateStr) {
        const reminders = [];
        const todayStr = TimeSimulator.getTodayString();

        // Chỉ hiển thị nhắc nhở cho ngày hôm nay
        if (dateStr !== todayStr) {
            return reminders;
        }

        const now = TimeSimulator.now();
        const registrations = this.getMemberRegistrationsForDate(memberId, dateStr);

        const meals = [
            CONFIG.MEAL_TYPES.BREAKFAST,
            CONFIG.MEAL_TYPES.LUNCH,
            CONFIG.MEAL_TYPES.DINNER
        ];

        meals.forEach(meal => {
            const todayDate = new Date(todayStr + "T00:00:00");
            const reminderEndDate = new Date(todayDate);
            reminderEndDate.setHours(meal.reminderEndHour, meal.reminderEndMinute, 0, 0);

            // Không nhắc nếu đã qua giờ kết thúc nhắc nhở (giờ ăn)
            if (now >= reminderEndDate) {
                return;
            }

            // Kiểm tra đã đăng ký bữa này chưa
            const isRegistered = registrations.some(r => r.mealType === meal.id);
            if (!isRegistered) {
                const deadlineDate = new Date(todayDate);
                deadlineDate.setHours(meal.deadlineHour, meal.deadlineMinute, 0, 0);

                const diffMs = deadlineDate - now;
                const isPastDeadline = diffMs <= 0;
                const remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
                const remainingMinutes = Math.floor(remainingSeconds / 60);
                const remainingSecs = remainingSeconds % 60;
                const isUrgent = !isPastDeadline && remainingMinutes < 30;

                let timeFormatted = "";
                if (!isPastDeadline) {
                    if (remainingMinutes >= 60) {
                        const hours = Math.floor(remainingMinutes / 60);
                        const mins = remainingMinutes % 60;
                        timeFormatted = `${hours} giờ ${mins} phút`;
                    } else {
                        timeFormatted = `${remainingMinutes} phút ${remainingSecs} giây`;
                    }
                }

                let text = "";
                if (isPastDeadline) {
                    text = `Đã hết hạn đăng ký ${meal.name} (khóa lúc ${meal.deadline}). Vui lòng liên hệ Quản trị viên nếu cần hỗ trợ.`;
                } else if (isUrgent) {
                    text = `🚨 KHẨN CẤP: ${meal.name} sắp đóng cổng đăng ký! Còn ${timeFormatted} (khóa lúc ${meal.deadline}).`;
                } else {
                    text = `Bạn chưa đăng ký ${meal.name}. Vui lòng hoàn tất trước ${meal.deadline} (còn ${timeFormatted}).`;
                }

                reminders.push({
                    mealId: meal.id,
                    mealName: meal.name,
                    deadline: meal.deadline,
                    deadlineDate,
                    isPastDeadline,
                    isUrgent,
                    remainingSeconds,
                    remainingMinutes,
                    timeFormatted,
                    text
                });
            }
        });

        return reminders;
    },

    // Lưu đăng ký cơm cho thành viên
    saveRegistrations(memberId, dateStr, selections) {
        // selections: [{ mealType: 0, status: 0 }, ...]
        if (!memberId) {
            return { success: false, errors: ["Thông tin thành viên không hợp lệ!"] };
        }

        const todayStr = TimeSimulator.getTodayString();
        const selectedDate = new Date(dateStr + "T00:00:00");
        const todayDate = new Date(todayStr + "T00:00:00");

        if (selectedDate < todayDate) {
            return { success: false, errors: ["Không thể đăng ký cho ngày đã qua!"] };
        }

        const validSelections = selections.filter(s => s.status !== null && s.status !== undefined);
        if (validSelections.length === 0) {
            return { success: false, errors: ["Vui lòng chọn trạng thái cho ít nhất một bữa ăn!"] };
        }

        const errors = [];
        const allRegistrations = DB.getRegistrations();
        let savedCount = 0;
        const nowIso = TimeSimulator.now().toISOString();

        validSelections.forEach(selection => {
            const check = this.checkMealDeadline(dateStr, selection.mealType);
            if (check.isExpired) {
                errors.push(check.message || `Đã hết hạn đăng ký bữa ${getMealTypeInfo(selection.mealType).name}!`);
                return;
            }

            // Tìm bản ghi hiện có
            const existingIndex = allRegistrations.findIndex(r =>
                r.memberId === Number(memberId) &&
                r.mealDate === dateStr &&
                r.mealType === Number(selection.mealType)
            );

            if (existingIndex >= 0) {
                // Cập nhật
                allRegistrations[existingIndex].status = Number(selection.status);
                allRegistrations[existingIndex].registeredAt = nowIso;
            } else {
                // Tạo mới
                const newId = allRegistrations.length > 0 ?
                    Math.max(...allRegistrations.map(r => r.id || 0)) + 1 : 1;

                allRegistrations.push({
                    id: newId,
                    memberId: Number(memberId),
                    mealDate: dateStr,
                    mealType: Number(selection.mealType),
                    status: Number(selection.status),
                    registeredAt: nowIso,
                    lateReason: null
                });
            }
            savedCount++;
        });

        if (savedCount > 0) {
            DB.saveRegistrations(allRegistrations);
        }

        return {
            success: errors.length === 0,
            savedCount,
            errors
        };
    },

    // Lấy lịch sử đăng ký của thành viên
    getMemberHistory(memberId, dateFilter = null) {
        const registrations = DB.getRegistrations().filter(r => r.memberId === Number(memberId));
        const members = DB.getMembers();
        const member = members.find(m => m.id === Number(memberId));

        let filtered = registrations;
        if (dateFilter) {
            filtered = filtered.filter(r => r.mealDate === dateFilter);
        }

        // Sắp xếp ngày giảm dần, bữa ăn tăng dần
        filtered.sort((a, b) => {
            if (a.mealDate !== b.mealDate) {
                return b.mealDate.localeCompare(a.mealDate);
            }
            return a.mealType - b.mealType;
        });

        return filtered.map(r => ({
            ...r,
            memberName: member ? member.fullName : "Thành viên",
            mealInfo: getMealTypeInfo(r.mealType),
            statusInfo: getMealStatusInfo(r.status)
        }));
    }
};
