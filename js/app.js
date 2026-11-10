/**
 * app.js - Trình điều khiển ứng dụng chính (UI Controller & Router)
 */

const App = {
    currentView: "login",
    activeMealDate: null,
    activeAdminDate: null,

    init() {
        console.log("Khởi động ứng dụng Hệ Thống Đăng Ký Cơm...");

        // Khởi tạo ngày mặc định
        this.activeMealDate = TimeSimulator.getTodayString();
        this.activeAdminDate = TimeSimulator.getTodayString();

        // Đăng ký sự kiện
        this.bindEvents();

        // Kiểm tra phiên đăng nhập và định tuyến
        this.handleRouting();

        // Khởi tạo widget giả lập thời gian
        this.initTimeSimulatorWidget();
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

        if (!currentUser) {
            navbarNav.innerHTML = "";
            userNavInfo.innerHTML = `
                <a href="#login" class="btn btn-outline-light btn-sm">Đăng nhập</a>
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
            `;
        } else if (AuthService.isAdmin()) {
            navLinksHtml = `
                <li class="nav-item">
                    <a class="nav-link ${this.currentView === "admin-meals" ? "active" : ""}" href="#admin-meals">
                        📋 Danh sách cơm
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

    quickLogin(username, password) {
        document.getElementById("loginUsername").value = username;
        document.getElementById("loginPassword").value = password;
        document.getElementById("loginForm").dispatchEvent(new Event("submit"));
    },

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
            reminderContainer.innerHTML = `
                <div class="alert alert-warning border-warning shadow-sm">
                    <h6 class="fw-bold mb-2">🔔 Nhắc nhở đăng ký cơm hôm nay:</h6>
                    <ul class="mb-0 ps-3">
                        ${reminders.map(r => `<li>${r.text}</li>`).join("")}
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
                : `<span class="badge bg-success">Đang mở (${check.deadlineText})</span>`;

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

    // ==========================================
    // 9. MÀN HÌNH QUẢN LÝ THÀNH VIÊN
    // ==========================================
    renderAdminMembers() {
        const members = MemberService.getAllMembers();
        const tbody = document.getElementById("membersTableBody");

        tbody.innerHTML = members.map(m => `
            <tr>
                <td>${m.id}</td>
                <td class="text-start fw-bold">${m.fullName}</td>
                <td>
                    ${m.hasAccount 
                        ? `<span class="badge bg-success">Đã có (${m.userName})</span>` 
                        : '<span class="badge bg-secondary">Chưa cấp</span>'}
                </td>
                <td>
                    ${m.isActive 
                        ? '<span class="badge bg-success">Đang hoạt động</span>' 
                        : '<span class="badge bg-danger">Đã khóa</span>'}
                </td>
                <td>
                    <button class="btn btn-sm ${m.isActive ? "btn-outline-danger" : "btn-outline-success"}"
                            onclick="App.handleToggleMember(${m.id})">
                        ${m.isActive ? "Khóa" : "Kích hoạt"}
                    </button>
                </td>
            </tr>
        `).join("");
    },

    handleAddMember() {
        const input = document.getElementById("newMemberFullName");
        const name = input.value;
        const result = MemberService.addMember(name);

        if (result.success) {
            this.showToast(result.message, "success");
            input.value = "";
            this.renderAdminMembers();
        } else {
            this.showToast(result.message, "danger");
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
    // 11. WIDGET GIẢ LẬP THỜI GIAN (TIME SIMULATOR)
    // ==========================================
    initTimeSimulatorWidget() {
        const widget = document.getElementById("timeSimulatorWidget");
        if (!widget) return;

        // Cập nhật đồng hồ mỗi giây
        setInterval(() => {
            const clockEl = document.getElementById("simClockDisplay");
            if (clockEl) {
                const now = TimeSimulator.now();
                const isSim = TimeSimulator.isSimulating();
                clockEl.textContent = `${TimeSimulator.formatDateTimeDisplay(now)} ${isSim ? "(Giả lập)" : ""}`;
            }
        }, 1000);
    },

    toggleSimulatorWidget() {
        const widget = document.getElementById("timeSimulatorWidget");
        widget.classList.toggle("collapsed");
    },

    setSimulatedPreset(hour, minute) {
        TimeSimulator.setTodayPreset(hour, minute);
        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        this.showToast(`Đã chuyển thời gian giả lập sang ${timeStr} hôm nay!`, "warning");
    },

    resetToRealTime() {
        TimeSimulator.resetToRealTime();
        this.showToast("Đã khôi phục thời gian thực tế của máy!", "success");
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
