/**
 * app.js - Trình điều khiển ứng dụng chính (UI Controller & Router)
 */

const App = {
    currentView: "login",
    activeMealDate: null,
    activeAdminDate: null,
    activeAdminReminderDate: null,
    activeAdminReminderMealType: 1,
    countdownInterval: null,
    notifiedMeals: new Set(),
    activePublicStatsDate: null,
    publicStatsFilterMeal: "all",
    publicStatsFilterStatus: "eating",
    publicStatsSearchQuery: "",
    publicStatsAutoRefreshTimer: null,
    publicStatsAllMembers: [],
    qrTargetUrlType: "official",
    pendingDeleteMemberId: null,

    init() {
        console.log("Khởi động ứng dụng Hệ Thống Đăng Ký Cơm...");

        // Khởi tạo ngày mặc định
        this.activeMealDate = TimeSimulator.getTodayString();
        this.activeAdminDate = TimeSimulator.getTodayString();
        this.activeAdminReminderDate = TimeSimulator.getTodayString();
        this.activePublicStatsDate = TimeSimulator.getTodayString();

        // Đăng ký sự kiện
        this.bindEvents();

        // Kiểm tra phiên đăng nhập và định tuyến
        this.handleRouting();

        // Khởi chạy đồng hồ đếm ngược thời gian thực và nhắc nhở
        this.startCountdownTimer();
    },

    bindEvents() {
        // Lắng nghe thay đổi xác thực
        window.addEventListener("meal_auth_changed", () => {
            this.handleRouting();
        });

        // Lắng nghe thay đổi giờ hệ thống
        window.addEventListener("meal_time_changed", () => {
            this.refreshCurrentView();
        });

        // Lắng nghe cập nhật đăng ký
        window.addEventListener("meal_registrations_updated", () => {
            this.refreshCurrentView();
        });

        // Lắng nghe dữ liệu đồng bộ từ Google Cloud Firestore
        window.addEventListener("cloud-data-updated", () => {
            this.refreshCurrentView();
        });

        // Lắng nghe hash change (URL routing)
        window.addEventListener("hashchange", () => {
            this.handleRouting();
        });
    },

    // Quản lý định tuyến và hiển thị View
    handleRouting() {
        const hash = window.location.hash.replace("#", "") || "";
        const currentUser = AuthService.getCurrentUser();

        // 1. Cho phép xem Thống kê công khai mà không cần tài khoản / không cần đăng nhập
        if (hash === "public-stats" || hash === "thong-ke" || hash === "stats") {
            this.showView("public-stats");
            return;
        }

        // Chưa đăng nhập -> Luôn đưa về màn hình Login
        if (!currentUser) {
            this.showView("login");
            return;
        }

        // Đã đăng nhập: Kiểm tra phân quyền truy cập
        if (AuthService.isMember()) {
            if (hash.startsWith("admin-")) {
                this.showToast("Bạn không có quyền truy cập trang quản trị!", "danger");
                window.location.hash = "#meal-register";
                return;
            }
            if (!hash || hash === "login") {
                this.showView("meal-register");
                return;
            }
        }

        if (AuthService.isAdmin()) {
            if (!hash || hash === "login") {
                this.showView("admin-meals");
                return;
            }
        }

        // Định tuyến theo hash
        this.showView(hash);
    },

    showView(viewName) {
        this.currentView = viewName;

        // Dừng auto-refresh nếu rời khỏi public-stats
        if (viewName !== "public-stats") {
            this.stopPublicStatsAutoRefresh();
        }

        // Ẩn tất cả các view
        document.querySelectorAll(".app-view").forEach(el => el.classList.add("d-none"));

        // Hiển thị view được chọn
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) {
            targetView.classList.remove("d-none");
        } else {
            console.warn(`View không tồn tại: view-${viewName}`);
        }

        // Cập nhật Navbar
        this.renderNavbar();

        // Kích hoạt render nội dung cho view tương ứng
        switch (viewName) {
            case "public-stats":
                this.renderPublicStats(this.activePublicStatsDate);
                this.startPublicStatsAutoRefresh();
                break;
            case "login":
                this.renderLogin();
                break;
            case "meal-register":
                this.renderMealRegister(this.activeMealDate);
                break;
            case "meal-history":
                this.renderMealHistory();
                break;
            case "admin-meals":
                this.renderAdminMeals(this.activeAdminDate);
                break;
            case "admin-reminders":
                this.renderAdminReminders(this.activeAdminReminderDate, this.activeAdminReminderMealType);
                break;
            case "admin-override":
                this.renderAdminOverride();
                break;
            case "admin-history":
                this.renderAdminHistory(this.activeAdminDate);
                break;
            case "admin-stats":
                this.renderAdminStats(this.activeAdminDate);
                break;
            case "admin-members":
                this.renderAdminMembers();
                break;
            case "admin-accounts":
                this.renderAdminAccounts();
                break;
        }
    },

    refreshCurrentView() {
        this.showView(this.currentView);
    },

    // ==========================================
    // 1. RENDER NAVBAR & HEADER
    // ==========================================
    renderNavbar() {
        const currentUser = AuthService.getCurrentUser();
        const navbarNav = document.getElementById("mainNavbarNav");
        const userNavInfo = document.getElementById("userNavInfo");

        const publicLoginBtn = document.getElementById("publicStatsLoginBtn");
        if (publicLoginBtn) {
            if (currentUser) {
                publicLoginBtn.innerHTML = "⬅️ Bảng Điều Khiển";
                publicLoginBtn.href = AuthService.isAdmin() ? "#admin-meals" : "#meal-register";
            } else {
                publicLoginBtn.innerHTML = "🔑 Đăng Nhập";
                publicLoginBtn.href = "#login";
            }
        }

        if (!currentUser) {
            navbarNav.innerHTML = `
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "public-stats" ? "active" : ""}" href="#public-stats">
                        📊 Thống Kê Suất Ăn (Công khai)
                    </a>
                </li>
            `;
            userNavInfo.innerHTML = `
                <a href="#login" class="btn btn-outline-light btn-sm fw-bold">🔑 Đăng nhập</a>
            `;
            return;
        }

        let navLinksHtml = "";

        if (AuthService.isMember()) {
            navLinksHtml = `
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "meal-register" ? "active" : ""}" href="#meal-register">
                        📝 Đăng ký cơm
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "meal-history" ? "active" : ""}" href="#meal-history">
                        📜 Lịch sử của tôi
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "public-stats" ? "active" : ""}" href="#public-stats">
                        📊 Thống kê chung
                    </a>
                </li>
            `;
        } else if (AuthService.isAdmin()) {
            navLinksHtml = `
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "admin-meals" ? "active" : ""}" href="#admin-meals">
                        📋 Danh sách cơm
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "admin-reminders" ? "active" : ""}" href="#admin-reminders">
                        🔔 Nhắc nhở
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "admin-override" ? "active" : ""}" href="#admin-override">
                        ✏️ Đăng ký thay
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "admin-history" ? "active" : ""}" href="#admin-history">
                        🕒 Lịch sử thay đổi
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "admin-stats" ? "active" : ""}" href="#admin-stats">
                        📊 Thống kê
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "public-stats" ? "active" : ""}" href="#public-stats" title="Trang thống kê công khai quét bằng mã QR">
                        🌐 Trang QR công khai
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "admin-members" ? "active" : ""}" href="#admin-members">
                        👥 Thành viên
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "admin-accounts" ? "active" : ""}" href="#admin-accounts">
                        🔑 Cấp tài khoản
                    </a>
                </li>
            `;
        }

        navbarNav.innerHTML = navLinksHtml;

        const roleBadge = currentUser.role === CONFIG.ROLES.ADMIN
            ? '<span class="badge bg-danger ms-2">Admin</span>'
            : '<span class="badge bg-info text-dark ms-2">Thành viên</span>';

        userNavInfo.innerHTML = `
            <div class="d-flex align-items-center text-white">
                <span class="me-3">
                    Xin chào, <strong>${currentUser.fullName || currentUser.userName}</strong>
                    ${roleBadge}
                </span>
                <button class="btn btn-sm btn-outline-light" onclick="App.handleLogout()">
                    Đăng xuất
                </button>
            </div>
        `;
    },

    // ==========================================
    // 2. MÀN HÌNH ĐĂNG NHẬP
    // ==========================================
    renderLogin() {
        const form = document.getElementById("loginForm");
        form.onsubmit = (e) => {
            e.preventDefault();
            const username = document.getElementById("loginUsername").value;
            const password = document.getElementById("loginPassword").value;

            const result = AuthService.login(username, password);
            if (result.success) {
                App.showToast(`Chào mừng ${result.user.fullName || result.user.userName}!`, "success");
                if (result.user.role === CONFIG.ROLES.ADMIN) {
                    window.location.hash = "#admin-meals";
                } else {
                    window.location.hash = "#meal-register";
                }
            } else {
                App.showToast(result.message, "danger");
            }
        };
    },

    // quickLogin đã được loại bỏ để tăng cường bảo mật
    handleLogout() {
        AuthService.logout();
        this.showToast("Đã đăng xuất thành công!", "info");
        window.location.hash = "#login";
    },

    // ==========================================
    // 3. MÀN HÌNH ĐĂNG KÝ CƠM (THÀNH VIÊN)
    // ==========================================
    renderMealRegister(dateStr) {
        const member = AuthService.getCurrentMember();
        if (!member) return;

        this.activeMealDate = dateStr || TimeSimulator.getTodayString();
        const dateInput = document.getElementById("mealRegisterDate");
        dateInput.value = this.activeMealDate;
        dateInput.min = TimeSimulator.getTodayString(); // Không cho chọn ngày quá khứ

        document.getElementById("memberDisplayName").textContent = member.fullName;

        // Render thông báo nhắc nhở
        const reminders = MealService.getReminders(member.id, this.activeMealDate);
        const reminderContainer = document.getElementById("mealRemindersAlert");
        if (reminders.length > 0) {
            const hasUrgent = reminders.some(r => r.isUrgent);
            const notifPermission = NotificationService.getPermission();
            const showEnableNotifBtn = notifPermission === "default" || notifPermission === "prompt";

            reminderContainer.innerHTML = `
                <div class="alert ${hasUrgent ? "alert-danger border-danger" : "alert-warning border-warning"} shadow-sm">
                    <div class="d-flex flex-wrap justify-content-between align-items-center mb-2">
                        <h6 class="fw-bold mb-0">
                            ${hasUrgent ? "🚨 CẢNH BÁO: SẮP HẾT HẠN ĐĂNG KÝ CƠM HÔM NAY!" : "🔔 Nhắc nhở đăng ký cơm hôm nay:"}
                        </h6>
                        ${showEnableNotifBtn ? `
                            <button class="btn btn-sm btn-outline-dark fw-bold mt-2 mt-md-0" onclick="App.enableBrowserNotifications()">
                                🔔 Bật thông báo đẩy trên thiết bị này
                            </button>
                        ` : (notifPermission === "granted" ? `
                            <span class="badge bg-success text-white">🔔 Đã bật thông báo</span>
                        ` : "")}
                    </div>
                    <ul class="mb-0 ps-3">
                        ${reminders.map(r => `<li class="my-1">${r.text}</li>`).join("")}
                    </ul>
                </div>
            `;
            reminderContainer.classList.remove("d-none");
        } else {
            reminderContainer.classList.add("d-none");
        }

        // Lấy các đăng ký hiện tại trong ngày
        const existingRegs = MealService.getMemberRegistrationsForDate(member.id, this.activeMealDate);

        // Render từng card bữa ăn
        const meals = [
            CONFIG.MEAL_TYPES.BREAKFAST,
            CONFIG.MEAL_TYPES.LUNCH,
            CONFIG.MEAL_TYPES.DINNER
        ];

        const container = document.getElementById("mealCardsContainer");
        container.innerHTML = "";

        meals.forEach(meal => {
            const check = MealService.checkMealDeadline(this.activeMealDate, meal.id);
            const currentReg = existingRegs.find(r => r.mealType === meal.id);
            const currentStatus = currentReg ? currentReg.status : null;

            const isExpired = check.isExpired;
            const statusBadge = isExpired
                ? `<span class="badge bg-danger">Đã khóa (${meal.deadline})</span>`
                : `<span class="badge bg-success">Đang mở</span><span class="badge bg-warning text-dark ms-1 meal-countdown" data-meal-id="${meal.id}">⏳</span>`;

const cardHtml = `
                <div class="col-md-4 mb-3">
                    <div class="card h-100 ${meal.cardBorder}">
                        <div class="card-header ${meal.badgeClass} text-white d-flex justify-content-between align-items-center">
                            <span>${meal.name.toUpperCase()} - ${meal.mealTime}</span>
                            ${statusBadge}
                        </div>
                        <div class="card-body">
                            <p class="text-muted small mb-3">
                                ⏱️ Khóa đăng ký lúc: <strong>${meal.deadline}</strong>
                            </p>

                            <div class="form-check p-0">
                                <label class="meal-radio-label ${isExpired ? "disabled" : ""}">
                                    <input class="form-check-input me-2" type="radio" 
                                           name="meal_${meal.id}" value="${CONFIG.MEAL_STATUS.ON_TIME.id}"
                                           ${currentStatus === CONFIG.MEAL_STATUS.ON_TIME.id ? "checked" : ""}
                                           ${isExpired ? "disabled" : ""}>
                                    <span>🍚 Ăn đúng giờ</span>
                                </label>
                            </div>

                            <div class="form-check p-0">
                                <label class="meal-radio-label ${isExpired ? "disabled" : ""}">
                                    <input class="form-check-input me-2" type="radio" 
                                           name="meal_${meal.id}" value="${CONFIG.MEAL_STATUS.AFTER_MEAL.id}"
                                           ${currentStatus === CONFIG.MEAL_STATUS.AFTER_MEAL.id ? "checked" : ""}
                                           ${isExpired ? "disabled" : ""}>
                                    <span>🍲 Ăn sau</span>
                                </label>
                            </div>

                            <div class="form-check p-0">
                                <label class="meal-radio-label ${isExpired ? "disabled" : ""}">
                                    <input class="form-check-input me-2" type="radio" 
                                           name="meal_${meal.id}" value="${CONFIG.MEAL_STATUS.NO_MEAL.id}"
                                           ${currentStatus === CONFIG.MEAL_STATUS.NO_MEAL.id ? "checked" : ""}
                                           ${isExpired ? "disabled" : ""}>
                                    <span>❌ Không ăn</span>
                                </label>
                            </div>

                            ${currentStatus === CONFIG.MEAL_STATUS.NOT_REGISTERED.id ? `
                                <div class="alert alert-danger py-1 px-2 small mt-2 mb-0">
                                    ⚠️ Trạng thái: Chưa đăng ký (Quá hạn)
                                </div>
                            ` : ""}
                        </div>
                    </div>
                </div>
            `;
container.insertAdjacentHTML("beforeend", cardHtml);
        });

// Cập nhật ngay các mốc đếm ngược
this.updateLiveCountdowns();
    },

handleDateChange(newDate) {
    this.activeMealDate = newDate;
    this.renderMealRegister(newDate);
},

saveMealRegistration() {
    const member = AuthService.getCurrentMember();
    if (!member) return;

    const dateStr = document.getElementById("mealRegisterDate").value;

    const selections = [
        CONFIG.MEAL_TYPES.BREAKFAST,
        CONFIG.MEAL_TYPES.LUNCH,
        CONFIG.MEAL_TYPES.DINNER
    ].map(meal => {
        const checkedRadio = document.querySelector(`input[name="meal_${meal.id}"]:checked`);
        return {
            mealType: meal.id,
            status: checkedRadio ? Number(checkedRadio.value) : null
        };
    });

    const result = MealService.saveRegistrations(member.id, dateStr, selections);

    if (result.success) {
        this.showToast(`Lưu thành công ${result.savedCount} suất đăng ký!`, "success");
        this.renderMealRegister(dateStr);
    } else {
        const msg = result.errors.join("<br>");
        this.showToast(msg, "danger");
        this.renderMealRegister(dateStr);
    }
},

// ==========================================
// 4. MÀN HÌNH LỊCH SỬ THÀNH VIÊN
// ==========================================
renderMealHistory() {
    const member = AuthService.getCurrentMember();
    if (!member) return;

    const filterDate = document.getElementById("historyFilterDate").value || null;
    const histories = MealService.getMemberHistory(member.id, filterDate);

    const tbody = document.getElementById("memberHistoryTableBody");
    if (histories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted py-4">Chưa có lịch sử đăng ký nào.</td></tr>`;
        return;
    }

    tbody.innerHTML = histories.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${TimeSimulator.formatDateTimeDisplay(new Date(item.mealDate + "T00:00:00")).split(" ")[0]}</strong></td>
                <td><span class="badge ${item.mealInfo.badgeClass}">${item.mealInfo.name}</span></td>
                <td><span class="badge ${item.statusInfo.badgeClass}">${item.statusInfo.name}</span></td>
                <td class="small text-muted">${TimeSimulator.formatDateTimeDisplay(item.registeredAt) || "Tự động ghi nhận"}</td>
            </tr>
        `).join("");
},

// ==========================================
// 5. MÀN HÌNH QUẢN LÝ ĐĂNG KÝ CƠM (ADMIN)
// ==========================================
renderAdminMeals(dateStr) {
    this.activeAdminDate = dateStr || TimeSimulator.getTodayString();
    document.getElementById("adminMealDate").value = this.activeAdminDate;

    const registrations = AdminService.getRegistrationsByDate(this.activeAdminDate);
    const tbody = document.getElementById("adminMealTableBody");

    if (registrations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted py-4">Chưa có đăng ký nào trong ngày ${this.activeAdminDate}.</td></tr>`;
        return;
    }

    tbody.innerHTML = registrations.map((r, index) => `
            <tr>
                <td>${index + 1}</td>
                <td class="text-start fw-bold">${r.memberName}</td>
                <td><span class="badge ${r.mealInfo.badgeClass}">${r.mealInfo.name}</span></td>
                <td><span class="badge ${r.statusInfo.badgeClass}">${r.statusInfo.name}</span></td>
                <td class="small text-muted">${TimeSimulator.formatDateTimeDisplay(r.registeredAt) || "Hệ thống tự chốt"}</td>
                <td class="small text-start">${r.lateReason || "-"}</td>
            </tr>
        `).join("");
},

handleAdminDateChange(newDate) {
    this.activeAdminDate = newDate;
    this.renderAdminMeals(newDate);
},

// ==========================================
// 6. MÀN HÌNH ĐĂNG KÝ CƠM THAY (ADMIN OVERRIDE)
// ==========================================
renderAdminOverride() {
    const selectMember = document.getElementById("overrideMemberSelect");
    const activeMembers = MemberService.getActiveMembers();

    selectMember.innerHTML = `
            <option value="">-- Chọn thành viên --</option>
            ${activeMembers.map(m => `<option value="${m.id}">${m.fullName}</option>`).join("")}
        `;

    const dateInput = document.getElementById("overrideDate");
    dateInput.value = this.activeAdminDate || TimeSimulator.getTodayString();

    document.getElementById("overrideReason").value = "";
},

submitAdminOverride() {
    const memberId = document.getElementById("overrideMemberSelect").value;
    const dateStr = document.getElementById("overrideDate").value;
    const mealType = document.getElementById("overrideMealType").value;
    const newStatus = document.getElementById("overrideStatus").value;
    const reason = document.getElementById("overrideReason").value;

    const currentUser = AuthService.getCurrentUser();

    const result = AdminService.overrideRegistration({
        memberId,
        dateStr,
        mealType,
        newStatus,
        reason,
        actorName: currentUser ? (currentUser.fullName || currentUser.userName) : "Admin",
        actorUserId: currentUser ? currentUser.id : "admin"
    });

    if (result.success) {
        this.showToast(result.message, "success");
        this.activeAdminDate = dateStr;
        window.location.hash = "#admin-meals";
    } else {
        this.showToast(result.message, "danger");
    }
},

// ==========================================
// 7. MÀN HÌNH LỊCH SỬ THAY ĐỔI (AUDIT LOG)
// ==========================================
renderAdminHistory(dateStr) {
    const targetDate = dateStr || this.activeAdminDate || TimeSimulator.getTodayString();
    document.getElementById("adminHistoryDate").value = targetDate;

    const histories = AdminService.getHistories(targetDate);
    const tbody = document.getElementById("adminHistoryTableBody");

    if (histories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-muted py-4">Không có bản ghi can thiệp nào trong ngày ${targetDate}.</td></tr>`;
        return;
    }

    tbody.innerHTML = histories.map((h, index) => `
            <tr>
                <td>${index + 1}</td>
                <td class="text-start fw-bold">${h.memberName}</td>
                <td><span class="badge ${h.mealInfo.badgeClass}">${h.mealInfo.name}</span></td>
                <td>${h.oldStatusInfo ? `<span class="badge ${h.oldStatusInfo.badgeClass}">${h.oldStatusInfo.name}</span>` : '<span class="text-muted">Chưa đăng ký</span>'}</td>
                <td>➡️ <span class="badge ${h.newStatusInfo.badgeClass}">${h.newStatusInfo.name}</span></td>
                <td class="fw-bold">${h.actorName}</td>
                <td class="small text-muted">${TimeSimulator.formatDateTimeDisplay(h.actionAt)}</td>
                <td class="small text-start">${h.reason}</td>
            </tr>
        `).join("");
},

// ==========================================
// 8. MÀN HÌNH THỐNG KÊ (ADMIN STATS)
// ==========================================
renderAdminStats(dateStr) {
    const targetDate = dateStr || this.activeAdminDate || TimeSimulator.getTodayString();
    document.getElementById("adminStatsDate").value = targetDate;

    const stats = AdminService.getStatistics(targetDate);
    const tbody = document.getElementById("adminStatsTableBody");

    tbody.innerHTML = stats.map(item => `
            <tr>
                <td><strong class="fs-6">${item.mealInfo.name}</strong> (${item.mealInfo.mealTime})</td>
                <td class="text-success fw-bold">${item.onTimeCount}</td>
                <td class="text-warning fw-bold">${item.afterMealCount}</td>
                <td class="text-secondary">${item.noMealCount}</td>
                <td class="text-danger fw-bold">${item.notRegisteredCount}</td>
                <td class="table-primary fw-bold fs-6 text-primary">${item.totalEatingCount}</td>
                <td class="fw-bold">${item.totalMembers}</td>
            </tr>
        `).join("");
},

handleExportStatsCsv() {
    const targetDate = document.getElementById("adminStatsDate")?.value || this.activeAdminDate || TimeSimulator.getTodayString();
    AdminService.exportStatisticsCsv(targetDate);
    this.showToast(`Đã xuất và tải về file Excel thống kê suất ăn ngày ${targetDate}!`, "success");
},

// ==========================================
// 8C. THỐNG KÊ CÔNG KHAI & MÃ QR VĨNH VIỄN
// (PUBLIC STATS & PERMANENT QR CODE)
// ==========================================
renderPublicStats(dateStr) {
    const targetDate = dateStr || this.activePublicStatsDate || TimeSimulator.getTodayString();
    this.activePublicStatsDate = targetDate;

    const dateInput = document.getElementById("publicStatsDate");
    if (dateInput) dateInput.value = targetDate;

    // Định dạng ngày tiếng Việt hiển thị
    const dateLabel = document.getElementById("publicStatsDateLabel");
    if (dateLabel) {
        try {
            const parts = targetDate.split("-");
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
            dateLabel.textContent = `${days[d.getDay()]}, ${parts[2]}/${parts[1]}/${parts[0]}`;
        } catch (e) {
            dateLabel.textContent = targetDate;
        }
    }

    // Lấy dữ liệu thống kê từ AdminService
    const stats = AdminService.getStatistics(targetDate);
    const totalDayEating = stats.reduce((sum, s) => sum + s.totalEatingCount, 0);

    const eatingBadge = document.getElementById("publicTotalEatingBadge");
    if (eatingBadge) {
        eatingBadge.textContent = `${totalDayEating} suất ăn`;
    }

    // 1. Render 4 thẻ chỉ số nhanh (Metric Cards)
    const metricContainer = document.getElementById("publicStatsMetricCards");
    if (metricContainer) {
        const mealIcons = ["🌅", "☀️", "🌇"];
        const cardStyles = [
            { bg: "bg-warning bg-opacity-10", border: "border-warning", text: "text-dark" },
            { bg: "bg-primary bg-opacity-10", border: "border-primary", text: "text-primary" },
            { bg: "bg-info bg-opacity-10", border: "border-info", text: "text-dark" }
        ];

        let cardsHtml = `
            <div class="col-6 col-lg-3">
                <div class="card border-success border-2 shadow-sm h-100 bg-success bg-opacity-10">
                    <div class="card-body p-3 text-center">
                        <div class="text-muted small fw-bold text-uppercase mb-1">🍲 Tổng Suất Cả Ngày</div>
                        <h2 class="fw-bold text-success display-6 mb-1">${totalDayEating}</h2>
                        <span class="badge bg-success">Tổng cả 3 bữa</span>
                    </div>
                </div>
            </div>
        `;

        stats.forEach((s, idx) => {
            const style = cardStyles[idx] || cardStyles[0];
            cardsHtml += `
                <div class="col-6 col-lg-3">
                    <div class="card ${style.border} shadow-sm h-100 ${style.bg}">
                        <div class="card-body p-3 text-center">
                            <div class="text-muted small fw-bold text-uppercase mb-1">
                                ${mealIcons[idx]} ${s.mealInfo.name} (${s.mealInfo.mealTime})
                            </div>
                            <h2 class="fw-bold ${style.text} display-6 mb-1">${s.totalEatingCount}</h2>
                            <div class="small">
                                <span class="badge bg-success" title="Ăn đúng giờ">Đúng giờ: ${s.onTimeCount}</span>
                                <span class="badge bg-warning text-dark" title="Ăn sau">Ăn sau: ${s.afterMealCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        metricContainer.innerHTML = cardsHtml;
    }

    // 2. Render Bảng tổng hợp số lượng từng bữa
    const tbody = document.getElementById("publicStatsTableBody");
    if (tbody) {
        const totalOnTime = stats.reduce((sum, s) => sum + s.onTimeCount, 0);
        const totalAfterMeal = stats.reduce((sum, s) => sum + s.afterMealCount, 0);
        const totalNoMeal = stats.reduce((sum, s) => sum + s.noMealCount, 0);
        const totalNotRegistered = stats.reduce((sum, s) => sum + s.notRegisteredCount, 0);
        const totalMembers = stats[0] ? stats[0].totalMembers : 0;

        let tableHtml = stats.map(s => `
            <tr>
                <td class="text-start fw-bold fs-6">
                    ${s.mealInfo.id === 0 ? "🌅" : (s.mealInfo.id === 1 ? "☀️" : "🌇")} ${s.mealInfo.name}
                    <div class="small text-muted fw-normal">Hạn chốt: ${s.mealInfo.deadline}</div>
                </td>
                <td class="fw-bold">${s.mealInfo.mealTime}</td>
                <td class="text-success fw-bold fs-6">${s.onTimeCount}</td>
                <td class="text-warning fw-bold fs-6">${s.afterMealCount}</td>
                <td class="text-secondary">${s.noMealCount}</td>
                <td class="text-danger fw-bold">${s.notRegisteredCount}</td>
                <td class="table-primary text-primary fw-bold fs-5">${s.totalEatingCount}</td>
                <td class="fw-bold text-muted">${s.totalMembers}</td>
            </tr>
        `).join("");

        // Dòng tổng cộng
        tableHtml += `
            <tr class="table-light fw-bold border-top border-2 border-dark">
                <td class="text-start text-success fs-6">⭐️ TỔNG CỘNG HÔM NAY</td>
                <td>-</td>
                <td class="text-success fs-6">${totalOnTime}</td>
                <td class="text-warning fs-6">${totalAfterMeal}</td>
                <td class="text-secondary">${totalNoMeal}</td>
                <td class="text-danger">${totalNotRegistered}</td>
                <td class="table-success text-success fw-bold fs-4">${totalDayEating}</td>
                <td class="text-dark">${totalMembers}</td>
            </tr>
        `;

        tbody.innerHTML = tableHtml;
    }

    // 3. Chuẩn bị danh sách thành viên chi tiết
    this.preparePublicMembersData(targetDate);
    this.renderPublicMembersTable();
},

changePublicStatsDate(offsetDays) {
    const currentDateStr = this.activePublicStatsDate || TimeSimulator.getTodayString();
    const parts = currentDateStr.split("-");
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + offsetDays);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const newDateStr = `${y}-${m}-${day}`;

    this.renderPublicStats(newDateStr);
},

setPublicStatsDateToday() {
    const todayStr = TimeSimulator.getTodayString();
    this.renderPublicStats(todayStr);
},

refreshPublicStats() {
    this.renderPublicStats(this.activePublicStatsDate);
    this.showToast("Đã làm mới dữ liệu thống kê suất ăn!", "success");
},

preparePublicMembersData(targetDate) {
    const activeMembers = DB.getMembers().filter(m => m.isActive);
    const registrations = DB.getRegistrations().filter(r => r.mealDate === targetDate);
    const mealTypes = [
        CONFIG.MEAL_TYPES.BREAKFAST,
        CONFIG.MEAL_TYPES.LUNCH,
        CONFIG.MEAL_TYPES.DINNER
    ];

    const list = [];
    mealTypes.forEach(meal => {
        activeMembers.forEach(member => {
            const reg = registrations.find(r => r.mealType === meal.id && r.memberId === member.id);
            if (reg) {
                list.push({
                    memberId: member.id,
                    memberName: member.fullName,
                    department: member.department || "Cơ quan",
                    mealType: meal.id,
                    mealName: meal.name,
                    mealTime: meal.mealTime,
                    status: reg.status,
                    statusInfo: getMealStatusInfo(reg.status),
                    registeredAt: reg.registeredAt,
                    lateReason: reg.lateReason || ""
                });
            } else {
                list.push({
                    memberId: member.id,
                    memberName: member.fullName,
                    department: member.department || "Cơ quan",
                    mealType: meal.id,
                    mealName: meal.name,
                    mealTime: meal.mealTime,
                    status: "unregistered",
                    statusInfo: { id: -1, name: "Chưa đăng ký", badgeClass: "bg-danger" },
                    registeredAt: null,
                    lateReason: ""
                });
            }
        });
    });

    this.publicStatsAllMembers = list;
},

filterPublicMembersByMeal(mealType, btnEl) {
    this.publicStatsFilterMeal = mealType;

    if (btnEl) {
        const group = document.getElementById("publicMealFilterGroup");
        if (group) {
            group.querySelectorAll(".btn").forEach(b => b.classList.remove("active"));
            btnEl.classList.add("active");
        }
    }

    this.renderPublicMembersTable();
},

filterPublicMembersList() {
    const statusEl = document.getElementById("publicStatusFilter");
    if (statusEl) this.publicStatsFilterStatus = statusEl.value;

    const searchEl = document.getElementById("publicMemberSearch");
    if (searchEl) this.publicStatsSearchQuery = searchEl.value.trim();

    this.renderPublicMembersTable();
},

renderPublicMembersTable() {
    if (!this.publicStatsAllMembers) return;

    let items = [...this.publicStatsAllMembers];

    // Lọc theo bữa ăn
    if (this.publicStatsFilterMeal !== "all") {
        const mealId = parseInt(this.publicStatsFilterMeal, 10);
        items = items.filter(i => i.mealType === mealId);
    }

    // Lọc theo trạng thái
    if (this.publicStatsFilterStatus === "eating") {
        items = items.filter(i => i.status === CONFIG.MEAL_STATUS.ON_TIME.id || i.status === CONFIG.MEAL_STATUS.AFTER_MEAL.id);
    } else if (this.publicStatsFilterStatus === "unregistered") {
        items = items.filter(i => i.status === "unregistered" || i.status === CONFIG.MEAL_STATUS.NOT_REGISTERED.id);
    } else if (this.publicStatsFilterStatus !== "all") {
        const statusId = parseInt(this.publicStatsFilterStatus, 10);
        items = items.filter(i => i.status === statusId);
    }

    // Tìm kiếm tên thành viên
    if (this.publicStatsSearchQuery) {
        const q = this.publicStatsSearchQuery.toLowerCase();
        items = items.filter(i => i.memberName.toLowerCase().includes(q) || (i.department && i.department.toLowerCase().includes(q)));
    }

    // Sắp xếp theo bữa, sau đó tên
    items.sort((a, b) => {
        if (a.mealType !== b.mealType) return a.mealType - b.mealType;
        return a.memberName.localeCompare(b.memberName, "vi");
    });

    const countBadge = document.getElementById("publicMemberListCount");
    if (countBadge) countBadge.textContent = `${items.length} lượt`;

    const tbody = document.getElementById("publicMembersTableBody");
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    Không có thành viên nào phù hợp với bộ lọc hiện tại.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map((item, idx) => {
        let statusBadge = "";
        if (item.status === CONFIG.MEAL_STATUS.ON_TIME.id) {
            statusBadge = '<span class="badge bg-success">✅ Ăn đúng giờ</span>';
        } else if (item.status === CONFIG.MEAL_STATUS.AFTER_MEAL.id) {
            statusBadge = '<span class="badge bg-warning text-dark">⏳ Ăn sau</span>';
        } else if (item.status === CONFIG.MEAL_STATUS.NO_MEAL.id) {
            statusBadge = '<span class="badge bg-secondary">❌ Không ăn</span>';
        } else {
            statusBadge = '<span class="badge bg-danger">⚠️ Chưa đăng ký</span>';
        }

        const mealIcon = item.mealType === 0 ? "🌅" : (item.mealType === 1 ? "☀️" : "🌇");
        const formattedTime = item.registeredAt ? new Date(item.registeredAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "-";
        const noteText = item.lateReason ? `<span class="text-danger fw-bold">Ăn lúc: ${item.lateReason}</span>` : '<span class="text-muted">-</span>';

        return `
            <tr>
                <td>${idx + 1}</td>
                <td class="text-start fw-bold text-dark">${item.memberName}</td>
                <td><span class="badge bg-light text-dark border">${mealIcon} ${item.mealName}</span></td>
                <td>${statusBadge}</td>
                <td class="small text-muted">${formattedTime}</td>
                <td class="text-start small">${noteText}</td>
            </tr>
        `;
    }).join("");
},

startPublicStatsAutoRefresh() {
    this.stopPublicStatsAutoRefresh();
    // Tự động làm mới dữ liệu sau mỗi 30 giây khi đang mở trang
    this.publicStatsAutoRefreshTimer = setInterval(() => {
        if (this.currentView === "public-stats") {
            this.renderPublicStats(this.activePublicStatsDate);
        }
    }, 30000);
},

stopPublicStatsAutoRefresh() {
    if (this.publicStatsAutoRefreshTimer) {
        clearInterval(this.publicStatsAutoRefreshTimer);
        this.publicStatsAutoRefreshTimer = null;
    }
},

// ==========================================
// CÁC HÀM XỬ LÝ MÃ QR VĨNH VIỄN
// ==========================================
showQrModal() {
    const modalEl = document.getElementById("qrCodeModal");
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    setTimeout(() => {
        this.renderQrCodeInModal();
    }, 150);
},

getQrTargetUrl() {
    if (this.qrTargetUrlType === "current" && window.location.origin && window.location.origin !== "null") {
        const pathname = window.location.pathname.replace(/\/+$/, "") + "/";
        return `${window.location.origin}${pathname}#public-stats`;
    }
    // Mặc định luôn là URL triển khai vĩnh viễn trên GitHub Pages
    return "https://sky-bro-12.github.io/DangKyCom/#public-stats";
},

handleQrUrlTypeChange(type) {
    this.qrTargetUrlType = type;
    this.renderQrCodeInModal();
},

renderQrCodeInModal() {
    const targetUrl = this.getQrTargetUrl();
    const inputEl = document.getElementById("qrTargetUrlInput");
    if (inputEl) inputEl.value = targetUrl;

    const directLinkEl = document.getElementById("qrDirectLink");
    if (directLinkEl) directLinkEl.href = "#public-stats";

    const canvas = document.getElementById("qrCanvas");
    if (canvas && typeof QRCodeHelper !== "undefined") {
        QRCodeHelper.renderToCanvas(canvas, targetUrl, { cellSize: 8, margin: 20 });
    }
},

copyQrTargetUrl() {
    const url = this.getQrTargetUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            this.showToast("Đã sao chép liên kết thống kê công khai!", "success");
        }).catch(() => {
            this.fallbackCopyText(url);
        });
    } else {
        this.fallbackCopyText(url);
    }
},

fallbackCopyText(text) {
    const inputEl = document.getElementById("qrTargetUrlInput");
    if (inputEl) {
        inputEl.select();
        document.execCommand("copy");
        this.showToast("Đã sao chép liên kết thống kê công khai!", "success");
    }
},

downloadQrCodeImage() {
    const canvas = document.getElementById("qrCanvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "Ma_QR_Thong_Ke_Com_Vinh_Vien.png";
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast("Đã tải ảnh mã QR vĩnh viễn về máy!", "success");
},

printQrPoster() {
    const targetUrl = this.getQrTargetUrl();
    const canvas = document.getElementById("qrCanvas");
    const dataUrl = canvas ? canvas.toDataURL("image/png") : "qr-thong-ke.png";

    const printWin = window.open("", "_blank");
    if (!printWin) {
        alert("Trình duyệt đang chặn popup. Vui lòng cho phép popup để in biển dán tường!");
        return;
    }

    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Biển Quét Mã QR Thống Kê Cơm</title>
            <style>
                @page { size: A4 portrait; margin: 15mm; }
                body {
                    font-family: Arial, "Segoe UI", sans-serif;
                    text-align: center;
                    padding: 20px;
                    color: #1a1a1a;
                    background: #fff;
                }
                .poster-frame {
                    border: 4px solid #198754;
                    border-radius: 20px;
                    padding: 30px 20px;
                    max-width: 620px;
                    margin: 0 auto;
                    box-sizing: border-box;
                }
                .icon { font-size: 55px; margin-bottom: 5px; }
                h1 {
                    font-size: 26px;
                    color: #198754;
                    margin: 8px 0;
                    text-transform: uppercase;
                    letter-spacing: -0.5px;
                }
                h2 {
                    font-size: 19px;
                    color: #333;
                    margin: 4px 0 16px;
                }
                .qr-img {
                    width: 320px;
                    height: 320px;
                    border: 2px solid #ddd;
                    border-radius: 12px;
                    padding: 10px;
                    background: #fff;
                    margin: 10px auto;
                    display: block;
                }
                .badge {
                    display: inline-block;
                    background: #ffc107;
                    color: #000;
                    font-weight: bold;
                    padding: 8px 20px;
                    border-radius: 30px;
                    font-size: 15px;
                    margin-bottom: 15px;
                }
                .guide {
                    font-size: 14px;
                    color: #333;
                    line-height: 1.6;
                    margin: 20px auto 10px;
                    max-width: 480px;
                    text-align: left;
                    background: #f8f9fa;
                    padding: 14px 22px;
                    border-radius: 10px;
                    border-left: 4px solid #198754;
                }
                .url {
                    font-family: monospace;
                    font-size: 13px;
                    color: #0d6efd;
                    word-break: break-all;
                    margin-top: 15px;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 12px;
                    color: #888;
                }
                @media print {
                    .no-print { display: none !important; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="poster-frame">
                <div style="margin-bottom: 8px;">
                    <img src="assets/icon-192.png" alt="Logo" style="width: 85px; height: 85px; border-radius: 50%; border: 3px solid #198754; object-fit: contain;">
                </div>
                <h1>CỘNG ĐOÀN DỰ TU BIÊN HÒA</h1>
                <h2 style="color: #198754; font-weight: bold; margin: 4px 0 16px;">BẢNG THỐNG KÊ SUẤT ĂN CÔNG KHAI</h2>
                <div class="badge">⚡ KHÔNG CẦN TÀI KHOẢN • KHÔNG CẦN ĐĂNG NHẬP</div>
                <div>
                    <img class="qr-img" src="${dataUrl}" alt="Mã QR Thống Kê">
                </div>
                <div class="guide">
                    <strong>📱 HƯỚNG DẪN QUÉT XEM:</strong><br>
                    1. Mở camera điện thoại (iPhone/Android) hoặc quét qua <strong>Zalo</strong>.<br>
                    2. Hướng camera vào mã QR ở trên.<br>
                    3. Bấm vào đường link hiện ra để xem số lượng suất ăn <strong>Sáng, Trưa, Chiều</strong> và danh sách người ăn theo thời gian thực!
                </div>
                <div class="url">🔗 ${targetUrl}</div>
                <div class="footer">Dán tại cửa nhà bếp / phòng ăn / bảng tin để tiện theo dõi</div>
            </div>
            <div class="no-print" style="margin-top: 20px;">
                <button onclick="window.print()" style="padding: 10px 25px; font-size: 16px; font-weight: bold; background: #198754; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    🖨️ In Biển Ngay
                </button>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 400);
                };
            </script>
        </body>
        </html>
    `);
    printWin.document.close();
},

// ==========================================
// 8B. TRUNG TÂM NHẮC NHỞ (ADMIN REMINDERS)
// ==========================================
renderAdminReminders(dateStr, mealTypeId) {
    const targetDate = dateStr || this.activeAdminReminderDate || TimeSimulator.getTodayString();
    const targetMeal = mealTypeId !== undefined ? Number(mealTypeId) : (this.activeAdminReminderMealType !== undefined ? Number(this.activeAdminReminderMealType) : 1);

    this.activeAdminReminderDate = targetDate;
    this.activeAdminReminderMealType = targetMeal;

    const dateInput = document.getElementById("adminReminderDate");
    if (dateInput) dateInput.value = targetDate;

    const mealSelect = document.getElementById("adminReminderMealType");
    if (mealSelect) mealSelect.value = targetMeal;

    const mealInfo = getMealTypeInfo(targetMeal);
    const checkDeadline = MealService.checkMealDeadline(targetDate, targetMeal);
    const activeMembers = DB.getMembers().filter(m => m.isActive);
    const unregistered = AdminService.getUnregisteredMembers(targetDate, targetMeal);
    const registeredCount = activeMembers.length - unregistered.length;

    // Cập nhật thẻ tóm tắt
    const elTotal = document.getElementById("reminderTotalMembers");
    const elReg = document.getElementById("reminderRegisteredCount");
    const elUnreg = document.getElementById("reminderUnregisteredCount");
    const elBadge = document.getElementById("reminderDeadlineBadge");
    const elTableBadge = document.getElementById("unregisteredTableCountBadge");

    if (elTotal) elTotal.textContent = activeMembers.length;
    if (elReg) elReg.textContent = registeredCount;
    if (elUnreg) elUnreg.textContent = unregistered.length;
    if (elTableBadge) elTableBadge.textContent = `${unregistered.length} người`;

    if (elBadge) {
        if (checkDeadline.isExpired) {
            elBadge.className = "p-2 rounded text-center fw-bold border bg-danger bg-opacity-10 text-danger border-danger";
            elBadge.innerHTML = `🔒 ĐÃ KHÓA ĐĂNG KÝ (Lúc ${mealInfo.deadline})`;
        } else {
            elBadge.className = "p-2 rounded text-center fw-bold border bg-success bg-opacity-10 text-success border-success";
            elBadge.innerHTML = `🟢 ĐANG MỞ ĐĂNG KÝ (Khóa lúc ${mealInfo.deadline})`;
        }
    }

    // Tạo xem trước tin nhắn
    const previewEl = document.getElementById("reminderMessagePreview");
    if (previewEl) {
        previewEl.value = AdminService.generateReminderMessage(targetDate, targetMeal);
    }

    // Render bảng thành viên chưa đăng ký
    const tbody = document.getElementById("unregisteredMembersTableBody");
    if (!tbody) return;

    if (unregistered.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-4 text-success fw-bold">
                        🎉 Tuyệt vời! Tất cả ${activeMembers.length} thành viên đều đã đăng ký bữa ăn này!
                    </td>
                </tr>
            `;
        return;
    }

    const users = DB.getUsers();
    tbody.innerHTML = unregistered.map((m, index) => {
        const user = users.find(u => u.memberId === m.id);
        return `
                <tr>
                    <td>${index + 1}</td>
                    <td class="text-start fw-bold text-dark">${m.fullName}</td>
                    <td>${m.department || "-"}</td>
                    <td>${user ? `<code>${user.userName}</code>` : '<span class="badge bg-secondary">Chưa có</span>'}</td>
                    <td>
                        <a href="#admin-override" class="btn btn-sm btn-outline-danger" 
                           onclick="App.prefillOverrideMember(${m.id}, '${targetDate}', ${targetMeal})">
                            ✏️ Đăng ký thay
                        </a>
                    </td>
                </tr>
            `;
    }).join("");
},

handleAdminReminderFilterChange() {
    const date = document.getElementById("adminReminderDate").value;
    const mealType = document.getElementById("adminReminderMealType").value;
    this.renderAdminReminders(date, mealType);
},

prefillOverrideMember(memberId, dateStr, mealType) {
    window.location.hash = "#admin-override";
    setTimeout(() => {
        const memberSelect = document.getElementById("overrideMemberSelect");
        const dateInput = document.getElementById("overrideDate");
        const mealSelect = document.getElementById("overrideMealType");
        if (memberSelect) memberSelect.value = memberId;
        if (dateInput) dateInput.value = dateStr;
        if (mealSelect) mealSelect.value = mealType;
    }, 100);
},

    async copyReminderMessage() {
    const previewEl = document.getElementById("reminderMessagePreview");
    if (!previewEl || !previewEl.value) return;

    const success = await NotificationService.copyToClipboard(previewEl.value);
    if (success) {
        this.showToast("📋 Đã sao chép tin nhắn nhắc nhở! Bạn có thể dán (Ctrl + V) vào nhóm Zalo.", "success");
    } else {
        this.showToast("Không thể sao chép tự động, vui lòng chọn văn bản và sao chép thủ công.", "warning");
    }
},

    // Gửi nhắc nhở tới nhóm Zalo (Tự động copy tin nhắn + Mở nhóm Zalo để dán ngay)
    async sendZaloReminder() {
    const previewEl = document.getElementById("reminderMessagePreview");
    if (!previewEl || !previewEl.value) return;

    const res = await NotificationService.sendZaloReminder(previewEl.value);
    if (res.success) {
        this.showToast(res.message, "success");
    } else {
        this.showToast(res.message, "danger");
    }
},

showReminderZaloConfigModal() {
    const config = NotificationService.getZaloConfig();
    const groupUrlInput = document.getElementById("botConfigZaloGroupUrl");
    const webhookInput = document.getElementById("botConfigWebhookUrl");

    if (groupUrlInput) groupUrlInput.value = config.zaloGroupUrl || "";
    if (webhookInput) webhookInput.value = config.webhookUrl || "";

    const modalEl = document.getElementById("reminderBotConfigModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
},

saveReminderZaloConfig() {
    const groupUrlInput = document.getElementById("botConfigZaloGroupUrl");
    const webhookInput = document.getElementById("botConfigWebhookUrl");

    const groupUrl = groupUrlInput ? groupUrlInput.value.trim() : "";
    const webhook = webhookInput ? webhookInput.value.trim() : "";

    NotificationService.saveZaloConfig({
        zaloGroupUrl: groupUrl,
        webhookUrl: webhook
    });

    const modalEl = document.getElementById("reminderBotConfigModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    this.showToast("Đã lưu cấu hình Nhóm Zalo & Webhook thành công!", "success");
},

// Tương thích ngược
showReminderBotConfigModal() {
    this.showReminderZaloConfigModal();
},

saveReminderBotConfig() {
    this.saveReminderZaloConfig();
},

sendTelegramReminder() {
    this.sendZaloReminder();
},

// ==========================================
// NHẬP LIỆU & CẤP TÀI KHOẢN HÀNG LOẠT
// ==========================================
showBulkMembersModal() {
    const input = document.getElementById("bulkMembersInput");
    if (input) input.value = "";
    const modalEl = document.getElementById("bulkMembersModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
},

handleBulkAddMembersSubmit() {
    const input = document.getElementById("bulkMembersInput").value;
    const res = MemberService.addMembersBulk(input);
    if (res.success) {
        this.showToast(res.message, "success");
        const modalEl = document.getElementById("bulkMembersModal");
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
        this.renderAdminMembers();
    } else {
        this.showToast(res.message, "danger");
    }
},

handleBulkGenerateAccounts() {
    if (!confirm("Tự động tạo tài khoản cho toàn bộ thành viên chưa có tài khoản với mật khẩu mặc định 'Member@12345'?")) {
        return;
    }

    const res = MemberService.generateAccountsBulk("Member@12345");
    if (res.success) {
        this.showToast(res.message, "success");
        this.renderAdminAccounts();
    } else {
        this.showToast(res.message, "info");
    }
},

    // ==========================================
    // THÔNG BÁO TRÌNH DUYỆT & ĐẾM NGƯỢC THỜI GIAN THỰC
    // ==========================================
    async enableBrowserNotifications() {
    const perm = await NotificationService.requestPermission();
    if (perm === "granted") {
        this.showToast("🔔 Đã bật thông báo thành công! Bạn sẽ nhận được nhắc nhở khi sắp đến hạn khóa đăng ký cơm.", "success");
        NotificationService.showBrowserNotification("🍚 Hệ Thống Đăng Ký Cơm", "Đã bật nhận thông báo nhắc nhở thành công trên thiết bị này!");
        this.refreshCurrentView();
    } else {
        this.showToast("Trình duyệt đã từ chối quyền thông báo. Vui lòng cho phép quyền thông báo trong cài đặt trình duyệt.", "warning");
    }
},

startCountdownTimer() {
    if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
    }

    this.countdownInterval = setInterval(() => {
        this.updateLiveCountdowns();
    }, 1000);
},

updateLiveCountdowns() {
    const now = TimeSimulator.now();

    // 1. Cập nhật các badge countdown trên card bữa ăn nếu đang ở màn hình đăng ký
    document.querySelectorAll(".meal-countdown").forEach(badge => {
        const mealId = Number(badge.getAttribute("data-meal-id"));
        const mealInfo = getMealTypeInfo(mealId);
        const todayStr = TimeSimulator.getTodayString();
        const todayDate = new Date(todayStr + "T00:00:00");
        const deadlineDate = new Date(todayDate);
        deadlineDate.setHours(mealInfo.deadlineHour, mealInfo.deadlineMinute, 0, 0);

        const diffMs = deadlineDate - now;
        if (diffMs <= 0) {
            badge.className = "badge bg-danger ms-2 meal-countdown";
            badge.textContent = `🔒 Đã khóa (${mealInfo.deadline})`;
        } else {
            const totalSeconds = Math.floor(diffMs / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const padSec = String(seconds).padStart(2, "0");

            if (minutes < 30) {
                badge.className = "badge bg-danger text-white ms-2 meal-countdown";
                badge.textContent = `⏳ Khóa trong: ${minutes}:${padSec}`;
            } else if (minutes < 60) {
                badge.className = "badge bg-warning text-dark ms-2 meal-countdown";
                badge.textContent = `⏳ Còn ${minutes} phút`;
            } else {
                const hours = Math.floor(minutes / 60);
                const remMins = minutes % 60;
                badge.className = "badge bg-info text-dark ms-2 meal-countdown";
                badge.textContent = `⏳ Còn ${hours}h ${remMins}m`;
            }
        }
    });

    // 2. Kiểm tra nhắc nhở trình duyệt nếu là Member
    if (AuthService.isMember()) {
        this.checkAndTriggerBrowserReminders(now);
    }
},

checkAndTriggerBrowserReminders(now) {
    if (NotificationService.getPermission() !== "granted") return;

    const member = AuthService.getCurrentMember();
    if (!member) return;

    const todayStr = TimeSimulator.getTodayString();
    const reminders = MealService.getReminders(member.id, todayStr);

    reminders.forEach(r => {
        // Nếu còn dưới 30 phút và chưa khóa và chưa bắn thông báo trong phiên này
        if (r.isUrgent && !r.isPastDeadline) {
            const notifyKey = `${todayStr}_${member.id}_${r.mealId}`;
            if (!this.notifiedMeals.has(notifyKey)) {
                this.notifiedMeals.add(notifyKey);
                NotificationService.showBrowserNotification(
                    `🍚 Sắp Khóa Đăng Ký ${r.mealName}!`,
                    `Chỉ còn ${r.timeFormatted} nữa là đến giờ chốt (${r.deadline}). Bấm vào đây để chọn cơm ngay!`,
                    { url: "meal-register" }
                );
            }
        }
    });
},

// ==========================================
// 9. MÀN HÌNH QUẢN LÝ THÀNH VIÊN
// ==========================================
renderAdminMembers() {
    const members = MemberService.getAllMembers();
    const tbody = document.getElementById("membersTableBody");
    if (!tbody) return;

    if (members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Chưa có thành viên nào trong hệ thống.</td></tr>`;
        return;
    }

    tbody.innerHTML = members.map(m => `
            <tr>
                <td class="text-center">
                    <span class="badge bg-light text-dark border px-2 py-1 fw-bold fs-6">#${m.code || m.id}</span>
                </td>
                <td class="text-start">
                    <span class="fw-bold text-dark">${m.fullName}</span>
                </td>
                <td class="text-center">
                    ${m.department ? `<span class="badge bg-info text-dark">${m.department}</span>` : `<span class="text-muted small">-</span>`}
                </td>
                <td>
                    ${m.hasAccount
            ? `<code class="fw-bold text-primary">${m.userName}</code>`
            : '<span class="badge bg-secondary">Chưa cấp</span>'}
                </td>
                <td>
                    ${m.password
            ? `<code class="text-secondary">${m.password}</code>`
            : '<span class="text-muted small">Chưa có</span>'}
                </td>
                <td>
                    ${m.isActive
            ? '<span class="badge bg-success">Đang hoạt động</span>'
            : '<span class="badge bg-danger">Đã khóa</span>'}
                </td>
                <td>
                    <div class="d-flex justify-content-center gap-1">
                        <button class="btn btn-sm btn-outline-primary"
                                onclick="App.showEditMemberModal(${m.id})" title="Chỉnh sửa thông tin thành viên (Họ tên, Phòng/Tổ, Tài khoản, Mật khẩu)">
                            ✏️ Sửa
                        </button>
                        <button class="btn btn-sm ${m.isActive ? "btn-outline-warning text-dark" : "btn-outline-success"}"
                                onclick="App.handleToggleMember(${m.id})" title="${m.isActive ? "Vô hiệu hóa tạm thời (Khóa)" : "Mở kích hoạt"}">
                            ${m.isActive ? "Khóa" : "Mở"}
                        </button>
                        <button class="btn btn-sm btn-outline-danger"
                                onclick="App.confirmDeleteMember(${m.id})" title="Xóa vĩnh viễn cả phần cứng và phần mềm không thể phục hồi">
                            🗑️ Xóa
                        </button>
                    </div>
                </td>
            </tr>
        `).join("");
},

handleAddMember() {
    const nameInput = document.getElementById("newMemberFullName");
    const deptInput = document.getElementById("newMemberDepartment");
    const userInput = document.getElementById("newMemberUsername");
    const passInput = document.getElementById("newMemberPassword");

    const fullName = nameInput ? nameInput.value.trim() : "";
    const department = deptInput ? deptInput.value.trim() : "";
    const userName = userInput ? userInput.value.trim() : "";
    const password = passInput ? passInput.value.trim() : "";

    if (!fullName) {
        this.showToast("Vui lòng nhập họ và tên thành viên!", "warning");
        if (nameInput) nameInput.focus();
        return;
    }

    const result = MemberService.addMember({
        fullName,
        department,
        userName,
        password
    });

    if (result.success) {
        this.showToast(result.message, "success");
        if (nameInput) nameInput.value = "";
        if (deptInput) deptInput.value = "";
        if (userInput) userInput.value = "";
        if (passInput) passInput.value = "Member@12345";
        this.renderAdminMembers();
        if (this.currentView === "admin-accounts") {
            this.renderAdminAccounts();
        }
    } else {
        this.showToast(result.message, "danger");
    }
},

showEditMemberModal(memberId) {
    const member = MemberService.getMemberById(memberId);
    if (!member) {
        this.showToast("Không tìm thấy thông tin thành viên!", "danger");
        return;
    }

    document.getElementById("editMemberId").value = member.id;
    document.getElementById("editMemberCode").value = member.code ? `#${member.code}` : `#${member.id}`;
    document.getElementById("editMemberFullName").value = member.fullName || "";
    document.getElementById("editMemberDepartment").value = member.department || "";
    document.getElementById("editMemberUsername").value = member.userName || "";
    document.getElementById("editMemberPassword").value = member.password || "";
    document.getElementById("editMemberActive").checked = !!member.isActive;

    const modalEl = document.getElementById("editMemberModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
},

handleSaveEditMember() {
    const id = document.getElementById("editMemberId").value;
    const fullName = document.getElementById("editMemberFullName").value.trim();
    const department = document.getElementById("editMemberDepartment").value.trim();
    const userName = document.getElementById("editMemberUsername").value.trim();
    const password = document.getElementById("editMemberPassword").value.trim();
    const isActive = document.getElementById("editMemberActive").checked;

    if (!fullName) {
        this.showToast("Họ và tên thành viên không được để trống!", "warning");
        return;
    }

    const res = MemberService.updateMember({
        id,
        fullName,
        department,
        userName,
        password,
        isActive
    });

    if (res.success) {
        this.showToast(res.message, "success");
        const modalEl = document.getElementById("editMemberModal");
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
        this.renderAdminMembers();
        if (this.currentView === "admin-accounts") {
            this.renderAdminAccounts();
        }
    } else {
        this.showToast(res.message, "danger");
    }
},

generateRandomPassword(targetInputId) {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pw = "Mem@";
    for (let i = 0; i < 6; i++) {
        pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById(targetInputId);
    if (input) {
        input.value = pw;
        this.showToast(`Đã tạo mật khẩu gợi ý: ${pw}`, "info");
    }
},

handleToggleMember(memberId) {
    const result = MemberService.toggleMemberStatus(memberId);
    if (result.success) {
        this.showToast(result.message, "info");
        this.renderAdminMembers();
    } else {
        this.showToast(result.message, "danger");
    }
},

// Xác nhận và mở modal xóa vĩnh viễn thành viên (xóa cả phần cứng & phần mềm)
confirmDeleteMember(memberId) {
    const summary = MemberService.getMemberDeleteSummary(memberId);
    if (!summary) {
        this.showToast("Không tìm thấy thông tin thành viên!", "danger");
        return;
    }

    this.pendingDeleteMemberId = Number(memberId);

    const nameEl = document.getElementById("deleteModalMemberName");
    const idEl = document.getElementById("deleteModalMemberId");
    const userEl = document.getElementById("deleteModalMemberUser");
    const summaryEl = document.getElementById("deleteModalDataSummary");
    const chk = document.getElementById("confirmPermanentDeleteCheckbox");
    const btn = document.getElementById("btnConfirmPermanentDelete");

    if (nameEl) nameEl.textContent = summary.member.fullName;
    if (idEl) idEl.textContent = `#${summary.member.code || summary.member.id}`;
    if (userEl) userEl.textContent = summary.user ? `${summary.user.userName} (Đang liên kết)` : "Không có tài khoản";
    if (summaryEl) {
        summaryEl.textContent = `${summary.user ? "1 tài khoản đăng nhập, " : ""}${summary.regCount} bản ghi đăng ký cơm, ${summary.histCount} bản ghi lịch sử`;
    }

    if (chk) chk.checked = false;
    if (btn) btn.disabled = true;

    const modalEl = document.getElementById("deleteMemberConfirmModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
},

// Thực thi xóa vĩnh viễn thành viên khỏi toàn bộ hệ thống
executePermanentDeleteMember() {
    if (!this.pendingDeleteMemberId) return;

    const res = MemberService.permanentDeleteMember(this.pendingDeleteMemberId);
    this.pendingDeleteMemberId = null;

    const modalEl = document.getElementById("deleteMemberConfirmModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    if (res.success) {
        this.showToast(res.message, "success");
        this.renderAdminMembers();
        // Cập nhật lại các màn hình khác liên quan nếu cần
        if (this.currentView === "admin-accounts") {
            this.renderAdminAccounts();
        }
    } else {
        this.showToast(res.message, "danger");
    }
},

// ==========================================
// 10. MÀN HÌNH CẤP TÀI KHOẢN
// ==========================================
renderAdminAccounts() {
    const selectMember = document.getElementById("accountMemberSelect");
    const availableMembers = MemberService.getMembersWithoutAccount();

    if (availableMembers.length === 0) {
        selectMember.innerHTML = `<option value="">-- Tất cả thành viên đã có tài khoản --</option>`;
    } else {
        selectMember.innerHTML = `
                <option value="">-- Chọn thành viên cần cấp tài khoản --</option>
                ${availableMembers.map(m => `<option value="${m.id}">${m.fullName}</option>`).join("")}
            `;
    }

    document.getElementById("newAccountUsername").value = "";
    document.getElementById("newAccountPassword").value = "";

    // Render danh sách tài khoản hiện tại
    const users = DB.getUsers();
    const tbody = document.getElementById("accountsTableBody");

    tbody.innerHTML = users.map((u, index) => `
            <tr>
                <td>${index + 1}</td>
                <td class="text-start fw-bold">${u.fullName || "-"}</td>
                <td><code>${u.userName}</code></td>
                <td>
                    ${u.role === CONFIG.ROLES.ADMIN
            ? '<span class="badge bg-danger">Admin</span>'
            : '<span class="badge bg-primary">Member</span>'}
                </td>
                <td><code>${u.password}</code></td>
            </tr>
        `).join("");
},

handleCreateAccount() {
    const memberId = document.getElementById("accountMemberSelect").value;
    const username = document.getElementById("newAccountUsername").value;
    const password = document.getElementById("newAccountPassword").value;

    const result = MemberService.createMemberAccount({ memberId, userName: username, password });
    if (result.success) {
        this.showToast(result.message, "success");
        this.renderAdminAccounts();
    } else {
        this.showToast(result.message, "danger");
    }
},

// ==========================================
// TOAST THÔNG BÁO
// ==========================================
showToast(message, type = "success") {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;

    const id = `toast_${Date.now()}`;
    const toastHtml = `
            <div id="${id}" class="toast align-items-center text-white bg-${type} border-0 mb-2 shadow" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

    toastContainer.insertAdjacentHTML("beforeend", toastHtml);
    const toastEl = document.getElementById(id);
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();

    toastEl.addEventListener("hidden.bs.toast", () => {
        toastEl.remove();
    });
},

// Hiển thị Modal hướng dẫn kết nối Firebase Cloud
showCloudGuideModal() {
    const modalEl = document.getElementById("cloudGuideModal");
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}
};

// Khởi chạy khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", () => {
    App.init();
});
