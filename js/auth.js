/**
 * auth.js - Dịch vụ xác thực và phân quyền (Authentication & Authorization)
 */

const AuthService = {
    // Đăng nhập
    login(userName, password) {
        if (!userName || !password) {
            return {
                success: false,
                message: "Vui lòng nhập đầy đủ tên tài khoản và mật khẩu!"
            };
        }

        const cleanUserName = userName.trim().toLowerCase();
        const users = DB.getUsers();

        const user = users.find(u =>
            u.userName.toLowerCase() === cleanUserName &&
            u.password === password
        );

        if (!user) {
            return {
                success: false,
                message: "Tên tài khoản hoặc mật khẩu không chính xác!"
            };
        }

        // Nếu là thành viên, kiểm tra thành viên còn hoạt động không
        if (user.memberId) {
            const member = DB.getMembers().find(m => m.id === user.memberId);
            if (!member || !member.isActive) {
                return {
                    success: false,
                    message: "Tài khoản thuộc thành viên đã ngừng hoạt động!"
                };
            }
        }

        // Lưu phiên đăng nhập
        const sessionUser = {
            id: user.id,
            userName: user.userName,
            role: user.role,
            memberId: user.memberId,
            fullName: user.fullName
        };

        DB.set(CONFIG.STORAGE_KEYS.CURRENT_USER, sessionUser);
        this.triggerAuthChange(sessionUser);

        return {
            success: true,
            user: sessionUser
        };
    },

    // Đăng xuất
    logout() {
        DB.remove(CONFIG.STORAGE_KEYS.CURRENT_USER);
        this.triggerAuthChange(null);
    },

    // Lấy thông tin người dùng hiện tại
    getCurrentUser() {
        return DB.get(CONFIG.STORAGE_KEYS.CURRENT_USER, null);
    },

    // Lấy thông tin thành viên liên kết với người dùng hiện tại
    getCurrentMember() {
        const user = this.getCurrentUser();
        if (!user || !user.memberId) return null;
        return DB.getMembers().find(m => m.id === user.memberId && m.isActive) || null;
    },

    // Kiểm tra đã đăng nhập chưa
    isAuthenticated() {
        return this.getCurrentUser() !== null;
    },

    // Kiểm tra có phải Admin không
    isAdmin() {
        const user = this.getCurrentUser();
        return user !== null && user.role === CONFIG.ROLES.ADMIN;
    },

    // Kiểm tra có phải Member không
    isMember() {
        const user = this.getCurrentUser();
        return user !== null && user.role === CONFIG.ROLES.MEMBER;
    },

    // Kiểm tra độ mạnh mật khẩu (Tương đương cấu hình Identity trong C#)
    validatePassword(password) {
        if (!password || password.length < 8) {
            return { valid: false, message: "Mật khẩu phải có tối thiểu 8 ký tự!" };
        }
        if (!/\d/.test(password)) {
            return { valid: false, message: "Mật khẩu phải chứa ít nhất một chữ số!" };
        }
        if (!/[a-z]/.test(password)) {
            return { valid: false, message: "Mật khẩu phải chứa ít nhất một chữ thường!" };
        }
        return { valid: true };
    },

    // Bắn sự kiện thay đổi trạng thái xác thực
    triggerAuthChange(user) {
        const event = new CustomEvent("meal_auth_changed", { detail: { user } });
        window.dispatchEvent(event);
    }
};
