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

    // Thêm nhiều thành viên cùng lúc từ danh sách văn bản (mỗi dòng một tên)
    addMembersBulk(textList) {
        if (!textList || !textList.trim()) {
            return { success: false, message: "Vui lòng nhập danh sách họ tên thành viên!" };
        }

        const lines = textList.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) {
            return { success: false, message: "Không tìm thấy tên thành viên nào hợp lệ!" };
        }

        const members = DB.getMembers();
        let currentMaxId = members.length > 0 ? Math.max(...members.map(m => m.id || 0)) : 0;
        let addedCount = 0;

        lines.forEach(name => {
            currentMaxId++;
            members.push({
                id: currentMaxId,
                fullName: name,
                isActive: true
            });
            addedCount++;
        });

        DB.saveMembers(members);

        return {
            success: true,
            addedCount,
            message: `Đã thêm thành công ${addedCount} thành viên vào hệ thống!`
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

    // Lấy thông tin thống kê trước khi xóa vĩnh viễn (Phục vụ modal cảnh báo)
    getMemberDeleteSummary(memberId) {
        const id = Number(memberId);
        const members = DB.getMembers();
        const member = members.find(m => m.id === id);
        if (!member) return null;

        const users = DB.getUsers();
        const user = users.find(u => u.memberId === id);

        const registrations = DB.getRegistrations();
        const regCount = registrations.filter(r => r.memberId === id).length;

        const histories = DB.getHistories();
        const histCount = histories.filter(h => h.memberId === id).length;

        return {
            member,
            user,
            regCount,
            histCount
        };
    },

    // Xóa vĩnh viễn thành viên (xóa sạch toàn bộ phần cứng & phần mềm: members, users, registrations, histories)
    permanentDeleteMember(memberId) {
        const id = Number(memberId);
        const members = DB.getMembers();
        const member = members.find(m => m.id === id);

        if (!member) {
            return {
                success: false,
                message: "Không tìm thấy thành viên cần xóa!"
            };
        }

        // 1. Xóa thành viên khỏi danh sách members
        const remainingMembers = members.filter(m => m.id !== id);
        DB.set(CONFIG.STORAGE_KEYS.MEMBERS, remainingMembers);

        // 2. Xóa tài khoản người dùng liên kết trong users
        const users = DB.getUsers();
        const relatedUsers = users.filter(u => u.memberId === id);
        const remainingUsers = users.filter(u => u.memberId !== id);
        DB.set(CONFIG.STORAGE_KEYS.USERS, remainingUsers);

        // 3. Xóa toàn bộ lịch sử đăng ký cơm trong registrations
        const registrations = DB.getRegistrations();
        const relatedRegs = registrations.filter(r => r.memberId === id);
        const remainingRegistrations = registrations.filter(r => r.memberId !== id);
        DB.set(CONFIG.STORAGE_KEYS.REGISTRATIONS, remainingRegistrations);

        // 4. Xóa toàn bộ lịch sử can thiệp liên quan trong histories
        const histories = DB.getHistories();
        const relatedHistories = histories.filter(h => h.memberId === id);
        const remainingHistories = histories.filter(h => h.memberId !== id);
        DB.set(CONFIG.STORAGE_KEYS.HISTORIES, remainingHistories);

        // 5. Chuẩn bị danh sách Document ID để xóa vĩnh viễn trên Cloud Firestore
        const userDocIds = relatedUsers.map(u => u.id ? String(u.id) : (u.userName || String(id)));
        const regDocIds = relatedRegs.map(r => `${r.mealDate}_${r.memberId}_${r.mealType}`);
        const historyDocIds = relatedHistories.map(h => String(h.id));

        // Gọi xóa trên Cloud nếu có kết nối Firestore
        if (DB.isCloudReady) {
            DB.deleteMemberFromCloud(id, userDocIds, regDocIds, historyDocIds);
        }

        // 6. Nếu người dùng hiện tại đang đăng nhập là thành viên này thì tự động đăng xuất
        const currentUser = AuthService.getCurrentUser();
        if (currentUser && currentUser.memberId === id) {
            AuthService.logout();
        }

        return {
            success: true,
            member,
            deletedUserCount: relatedUsers.length,
            deletedRegCount: relatedRegs.length,
            deletedHistoryCount: relatedHistories.length,
            message: `Đã xóa vĩnh viễn thành viên "${member.fullName}" cùng toàn bộ dữ liệu liên quan! Không thể phục hồi.`
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
    },

    // Tự động cấp tài khoản hàng loạt cho tất cả thành viên chưa có tài khoản
    generateAccountsBulk(defaultPassword = "Member@12345") {
        const membersWithoutAccount = this.getMembersWithoutAccount();
        if (membersWithoutAccount.length === 0) {
            return {
                success: false,
                message: "Tất cả thành viên đang hoạt động đều đã có tài khoản!"
            };
        }

        const users = DB.getUsers();
        let createdCount = 0;

        membersWithoutAccount.forEach(member => {
            // Chuyển họ tên thành username không dấu viết liền
            let baseUsername = member.fullName
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d")
                .replace(/Đ/g, "D")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

            if (!baseUsername) {
                baseUsername = `member${member.id}`;
            }

            let username = baseUsername;
            let counter = 1;
            while (users.some(u => u.userName.toLowerCase() === username.toLowerCase())) {
                username = `${baseUsername}${counter}`;
                counter++;
            }

            const newUser = {
                id: `user_${Date.now()}_${member.id}`,
                userName: username,
                password: defaultPassword,
                role: CONFIG.ROLES.MEMBER,
                memberId: member.id,
                fullName: member.fullName
            };

            users.push(newUser);
            createdCount++;
        });

        DB.saveUsers(users);

        return {
            success: true,
            createdCount,
            message: `Đã cấp tự động ${createdCount} tài khoản thành công! Mật khẩu mặc định: ${defaultPassword}`
        };
    }
};
