/**
 * memberService.js - Quản lý thành viên và Cấp tài khoản đăng nhập
 */

const MemberService = {
    // Lấy tất cả thành viên
    getAllMembers() {
        const members = DB.getMembers();
        const users = DB.getUsers();

        // Gắn kèm thông tin tài khoản (nếu có)
        return members.map(m => {
            const user = users.find(u => u.memberId === m.id);
            return {
                ...m,
                hasAccount: !!user,
                userName: user ? user.userName : null
            };
        });
    },

    // Lấy danh sách thành viên đang hoạt động
    getActiveMembers() {
        return DB.getMembers().filter(m => m.isActive);
    },

    // Thêm mới thành viên
    addMember(fullName) {
        const name = (fullName || "").trim();
        if (!name) {
            return {
                success: false,
                message: "Vui lòng nhập họ và tên thành viên!"
            };
        }

        const members = DB.getMembers();
        const newId = members.length > 0 ? Math.max(...members.map(m => m.id || 0)) + 1 : 1;

        const newMember = {
            id: newId,
            fullName: name,
            isActive: true
        };

        members.push(newMember);
        DB.saveMembers(members);

        return {
            success: true,
            member: newMember,
            message: `Đã thêm thành viên "${name}" thành công!`
        };
    },

    // Bật/tắt trạng thái hoạt động của thành viên
    toggleMemberStatus(memberId) {
        const members = DB.getMembers();
        const member = members.find(m => m.id === Number(memberId));
        if (!member) {
            return { success: false, message: "Không tìm thấy thành viên!" };
        }

        member.isActive = !member.isActive;
        DB.saveMembers(members);

        return {
            success: true,
            isActive: member.isActive,
            message: `Đã ${member.isActive ? "kích hoạt" : "vô hiệu hóa"} thành viên ${member.fullName}!`
        };
    },

    // Lấy danh sách thành viên chưa có tài khoản đăng nhập
    getMembersWithoutAccount() {
        const activeMembers = this.getActiveMembers();
        const users = DB.getUsers();
        return activeMembers.filter(m => !users.some(u => u.memberId === m.id));
    },

    // Tạo tài khoản cho thành viên
    createMemberAccount({ memberId, userName, password }) {
        if (!memberId) {
            return { success: false, message: "Vui lòng chọn thành viên!" };
        }

        const cleanUserName = (userName || "").trim();
        if (!cleanUserName) {
            return { success: false, message: "Vui lòng nhập tên tài khoản!" };
        }

        // Kiểm tra định dạng mật khẩu
        const pwCheck = AuthService.validatePassword(password);
        if (!pwCheck.valid) {
            return { success: false, message: pwCheck.message };
        }

        const member = DB.getMembers().find(m => m.id === Number(memberId) && m.isActive);
        if (!member) {
            return { success: false, message: "Thành viên không tồn tại hoặc đã ngừng hoạt động!" };
        }

        const users = DB.getUsers();

        // Kiểm tra thành viên đã có tài khoản chưa
        const alreadyHasAccount = users.some(u => u.memberId === Number(memberId));
        if (alreadyHasAccount) {
            return { success: false, message: "Thành viên này đã có tài khoản!" };
        }

        // Kiểm tra trùng tên tài khoản
        const userExists = users.some(u => u.userName.toLowerCase() === cleanUserName.toLowerCase());
        if (userExists) {
            return { success: false, message: "Tên tài khoản này đã được sử dụng!" };
        }

        const newUser = {
            id: `user_${Date.now()}`,
            userName: cleanUserName,
            password: password,
            role: CONFIG.ROLES.MEMBER,
            memberId: Number(memberId),
            fullName: member.fullName
        };

        users.push(newUser);
        DB.saveUsers(users);

        return {
            success: true,
            user: newUser,
            message: `Tạo tài khoản "${cleanUserName}" cho thành viên "${member.fullName}" thành công!`
        };
    }
};
