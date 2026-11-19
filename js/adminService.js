/**
 * adminService.js - Nghiệp vụ Quản trị viên (Đăng ký thay, Thống kê, Lịch sử can thiệp)
 */

const AdminService = {
    // Lấy danh sách đăng ký cơm theo ngày
    getRegistrationsByDate(dateStr) {
        const registrations = DB.getRegistrations().filter(r => r.mealDate === dateStr);
        const members = DB.getMembers();

        const results = registrations.map(r => {
            const member = members.find(m => m.id === r.memberId);
            return {
                ...r,
                memberName: member ? member.fullName : `Thành viên #${r.memberId}`,
                memberIsActive: member ? member.isActive : false,
                mealInfo: getMealTypeInfo(r.mealType),
                statusInfo: getMealStatusInfo(r.status)
            };
        });

        // Sắp xếp theo bữa ăn, sau đó theo tên thành viên
        results.sort((a, b) => {
            if (a.mealType !== b.mealType) {
                return a.mealType - b.mealType;
            }
            return a.memberName.localeCompare(b.memberName);
        });

        return results;
    },

    // Kiểm tra điều kiện cho phép đăng ký thay (Chỉ khi đã quá hạn)
    canOverride(dateStr, mealTypeId) {
        const mealInfo = getMealTypeInfo(mealTypeId);
        const now = TimeSimulator.now();

        const selectedDate = new Date(dateStr + "T00:00:00");
        const todayStr = TimeSimulator.getTodayString();
        const todayDate = new Date(todayStr + "T00:00:00");

        // Ngày trong quá khứ -> Đã qua hạn chắc chắn
        if (selectedDate < todayDate) {
            return { allowed: true };
        }

        // Ngày trong tương lai -> Chưa tới hạn chốt, không cho đăng ký thay
        if (selectedDate > todayDate) {
            return {
                allowed: false,
                message: `Chưa đến thời hạn đăng ký thay bữa ${mealInfo.name}. Vui lòng thực hiện sau ${mealInfo.deadline}.`
            };
        }

        // Ngày hôm nay: Kiểm tra thời điểm hiện tại đã vượt qua deadline chưa
        const deadlineDate = new Date(todayDate);
        deadlineDate.setHours(mealInfo.deadlineHour, mealInfo.deadlineMinute, 0, 0);

        if (now < deadlineDate) {
            return {
                allowed: false,
                message: `Chưa đến thời hạn đăng ký thay. Bữa ${mealInfo.name} sẽ mở đăng ký thay sau ${mealInfo.deadline}.`
            };
        }

        return { allowed: true };
    },

    // Thực hiện đăng ký thay (Override)
    overrideRegistration({ memberId, dateStr, mealType, newStatus, reason, actorName, actorUserId }) {
        // Kiểm tra trạng thái hợp lệ (Không được chọn trạng thái "Chưa đăng ký - Quá hạn")
        if (Number(newStatus) === CONFIG.MEAL_STATUS.NOT_REGISTERED.id) {
            return {
                success: false,
                message: "Không thể chọn trạng thái 'Chưa đăng ký - Quá hạn' khi đăng ký thay!"
            };
        }

        // Kiểm tra lý do bắt buộc
        const cleanReason = (reason || "").trim();
        if (!cleanReason) {
            return {
                success: false,
                message: "Vui lòng nhập lý do đăng ký thay!"
            };
        }

        // Kiểm tra thành viên
        const member = DB.getMembers().find(m => m.id === Number(memberId) && m.isActive);
        if (!member) {
            return {
                success: false,
                message: "Thành viên không tồn tại hoặc đã ngừng hoạt động!"
            };
        }

        // Kiểm tra hạn chốt
        const checkDeadline = this.canOverride(dateStr, mealType);
        if (!checkDeadline.allowed) {
            return {
                success: false,
                message: checkDeadline.message
            };
        }

        const nowIso = TimeSimulator.now().toISOString();
        const allRegistrations = DB.getRegistrations();
        const allHistories = DB.getHistories();

        // Tìm đăng ký hiện tại
        const existingIndex = allRegistrations.findIndex(r =>
            r.memberId === Number(memberId) &&
            r.mealDate === dateStr &&
            r.mealType === Number(mealType)
        );

        let oldStatus = null;

        if (existingIndex >= 0) {
            oldStatus = allRegistrations[existingIndex].status;
            allRegistrations[existingIndex].status = Number(newStatus);
            allRegistrations[existingIndex].registeredAt = nowIso;
            allRegistrations[existingIndex].lateReason = cleanReason;
        } else {
            const newRegId = allRegistrations.length > 0 ?
                Math.max(...allRegistrations.map(r => r.id || 0)) + 1 : 1;

            allRegistrations.push({
                id: newRegId,
                memberId: Number(memberId),
                mealDate: dateStr,
                mealType: Number(mealType),
                status: Number(newStatus),
                registeredAt: nowIso,
                lateReason: cleanReason
            });
        }

        // Ghi nhận Lịch sử thay đổi (Audit Log)
        const newHistoryId = allHistories.length > 0 ?
            Math.max(...allHistories.map(h => h.id || 0)) + 1 : 1;

        allHistories.push({
            id: newHistoryId,
            memberId: Number(memberId),
            mealDate: dateStr,
            mealType: Number(mealType),
            oldStatus: oldStatus,
            newStatus: Number(newStatus),
            actorName: actorName || "Quản Trị Viên",
            actorUserId: actorUserId || "admin",
            actionAt: nowIso,
            reason: cleanReason
        });

        // Lưu vào LocalStorage
        DB.saveRegistrations(allRegistrations);
        DB.saveHistories(allHistories);

        return {
            success: true,
            message: `Đã lưu đăng ký cơm thay cho ${member.fullName} thành công!`
        };
    },

    // Lấy lịch sử đăng ký thay (Audit Log)
    getHistories(dateStr) {
        const histories = DB.getHistories().filter(h => h.mealDate === dateStr);
        const members = DB.getMembers();

        const results = histories.map(h => {
            const member = members.find(m => m.id === h.memberId);
            return {
                ...h,
                memberName: member ? member.fullName : `Thành viên #${h.memberId}`,
                mealInfo: getMealTypeInfo(h.mealType),
                oldStatusInfo: h.oldStatus !== null && h.oldStatus !== undefined ? getMealStatusInfo(h.oldStatus) : null,
                newStatusInfo: getMealStatusInfo(h.newStatus)
            };
        });

        // Sắp xếp thời điểm thao tác mới nhất lên đầu
        results.sort((a, b) => new Date(b.actionAt) - new Date(a.actionAt));
        return results;
    },

    // Thống kê số lượng suất ăn (Khắc phục triệt để lỗi logic đếm số người chưa đăng ký)
    getStatistics(dateStr) {
        const activeMembers = DB.getMembers().filter(m => m.isActive);
        const totalMembers = activeMembers.length;
        const registrations = DB.getRegistrations().filter(r => r.mealDate === dateStr);

        const mealTypes = [
            CONFIG.MEAL_TYPES.BREAKFAST,
            CONFIG.MEAL_TYPES.LUNCH,
            CONFIG.MEAL_TYPES.DINNER
        ];

        return mealTypes.map(meal => {
            const mealRegistrations = registrations.filter(r => r.mealType === meal.id);

            const onTimeCount = mealRegistrations.filter(r => r.status === CONFIG.MEAL_STATUS.ON_TIME.id).length;
            const afterMealCount = mealRegistrations.filter(r => r.status === CONFIG.MEAL_STATUS.AFTER_MEAL.id).length;
            const noMealCount = mealRegistrations.filter(r => r.status === CONFIG.MEAL_STATUS.NO_MEAL.id).length;

            // Số người đã được đánh dấu trạng thái "Chưa đăng ký - Quá hạn"
            const markedNotRegistered = mealRegistrations.filter(r => r.status === CONFIG.MEAL_STATUS.NOT_REGISTERED.id).length;

            // Số thành viên hoàn toàn chưa có bản ghi nào trong hệ thống
            const unrecordedCount = Math.max(0, totalMembers - mealRegistrations.length);

            // Tổng số người chưa đăng ký = số người đã bị gán quá hạn + số người chưa ghi nhận
            const notRegisteredCount = markedNotRegistered + unrecordedCount;

            // Tổng số người dự kiến ăn = Ăn đúng giờ + Ăn sau
            const totalEatingCount = onTimeCount + afterMealCount;

            return {
                mealDate: dateStr,
                mealType: meal.id,
                mealInfo: meal,
                totalMembers,
                onTimeCount,
                afterMealCount,
                noMealCount,
                notRegisteredCount,
                totalEatingCount
            };
        });
    },

    // ==========================================
    // NHẮC NHỞ & XỬ LÝ CHƯA ĐĂNG KÝ
    // ==========================================

    // Lấy danh sách thành viên chưa đăng ký cho bữa ăn cụ thể trong ngày
    getUnregisteredMembers(dateStr, mealTypeId) {
        const activeMembers = DB.getMembers().filter(m => m.isActive);
        const registrations = DB.getRegistrations().filter(r => 
            r.mealDate === dateStr && 
            r.mealType === Number(mealTypeId)
        );

        return activeMembers.filter(m => {
            const reg = registrations.find(r => r.memberId === m.id);
            // Chưa có bản ghi hoặc đã bị gán trạng thái Quá hạn
            return !reg || reg.status === CONFIG.MEAL_STATUS.NOT_REGISTERED.id;
        });
    },

    // Tạo mẫu tin nhắn nhắc nhở đẹp mắt để copy gửi Zalo / Telegram
    generateReminderMessage(dateStr, mealTypeId) {
        const mealInfo = getMealTypeInfo(Number(mealTypeId));
        const unregistered = this.getUnregisteredMembers(dateStr, mealTypeId);
        const activeMembers = DB.getMembers().filter(m => m.isActive);
        const dateFormatted = TimeSimulator.formatDateTimeDisplay(new Date(dateStr + "T00:00:00")).split(" ")[0];

        let msg = `🍚 [NHẮC NHỞ ĐĂNG KÝ CƠM] 🍚\n`;
        msg += `📅 Ngày: ${dateFormatted}\n`;
        msg += `🍽️ Bữa ăn: ${mealInfo.name.toUpperCase()} (Giờ ăn: ${mealInfo.mealTime})\n`;
        msg += `⏰ Hạn chốt đăng ký: ${mealInfo.deadline}\n`;
        msg += `------------------------------------\n`;

        if (unregistered.length === 0) {
            msg += `🎉 Tuyệt vời! Toàn bộ ${activeMembers.length} thành viên đã hoàn tất đăng ký!\n`;
        } else {
            msg += `⚠️ Còn ${unregistered.length}/${activeMembers.length} anh em CHƯA ĐĂNG KÝ:\n`;
            unregistered.forEach((m, idx) => {
                const dept = m.department ? ` - ${m.department}` : "";
                msg += `${idx + 1}. ${m.fullName}${dept}\n`;
            });
            msg += `\n👉 Đề nghị anh em vào hệ thống đăng ký ngay trước ${mealInfo.deadline}:\n`;
            msg += window.location.href.split("#")[0];
        }

        return msg;
    },

    // Xuất báo cáo thống kê suất ăn dạng CSV (Excel mở trực tiếp không lỗi font UTF-8 BOM)
    exportStatisticsCsv(dateStr) {
        const stats = this.getStatistics(dateStr);
        const BOM = "\uFEFF";
        let csv = BOM + `BÁO CÁO THỐNG KÊ SUẤT ĂN NGÀY ${dateStr}\n\n`;
        csv += "Bữa ăn,Giờ ăn,Ăn đúng giờ,Ăn sau,Không ăn,Chưa đăng ký,Tổng suất dự kiến ăn,Tổng thành viên\n";

        stats.forEach(s => {
            csv += `"${s.mealInfo.name}","${s.mealInfo.mealTime}",${s.onTimeCount},${s.afterMealCount},${s.noMealCount},${s.notRegisteredCount},${s.totalEatingCount},${s.totalMembers}\n`;
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Thong_Ke_Suat_An_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
