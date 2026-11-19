/**
 * memberService.js - Quản lý thành viên và Cấp tài khoản đăng nhập
 */

const MemberService = {
    // Trích xuất tên (từ cuối cùng của họ và tên) để phục vụ sắp xếp A-Z
    getGivenName(fullName) {
        if (!fullName || typeof fullName !== "string") return "";
        const parts = fullName.trim().split(/\s+/);
        return parts[parts.length - 1] || "";
    },

    // Sắp xếp danh sách thành viên theo thứ tự A-Z theo tên (từ cuối cùng)
    sortMembersByName(members) {
        return [...members].sort((a, b) => {
            const nameA = this.getGivenName(a.fullName || "");
            const nameB = this.getGivenName(b.fullName || "");
            // So sánh theo chuẩn tiếng Việt cho tên chính
            const cmp = nameA.localeCompare(nameB, "vi", { sensitivity: "base" });
            if (cmp !== 0) return cmp;
            // Nếu trùng tên chính, so sánh toàn bộ họ tên để giữ thứ tự ổn định
            return (a.fullName || "").localeCompare(b.fullName || "", "vi", { sensitivity: "base" });
        });
    },

    // Sắp xếp danh sách A-Z theo tên và tự động đánh số mã thành viên từ 1 đến hết (1..N)
    sortAndReindexMembers(members) {
        const sorted = this.sortMembersByName(members);
        sorted.forEach((m, idx) => {
            m.code = idx + 1;
        });
        return sorted;
    },

    // Lấy tất cả thành viên (luôn đảm bảo sắp xếp A-Z theo tên, mã 1..N và kèm thông tin tài khoản)
    getAllMembers() {
        let members = DB.getMembers();
        const users = DB.getUsers();

        // Đảm bảo danh sách được sắp xếp và đánh số mã 1..N
        let needsSave = false;
        const sorted = this.sortAndReindexMembers(members);

        // Kiểm tra xem có cần cập nhật lại DB không
        if (members.length !== sorted.length) {
            needsSave = true;
        } else {
            for (let i = 0; i < sorted.length; i++) {
                if (!members[i] || members[i].id !== sorted[i].id || members[i].code !== sorted[i].code) {
                    needsSave = true;
                    break;
                }
            }
        }

        if (needsSave) {
            DB.saveMembers(sorted);
            members = sorted;
        } else {
            members = sorted;
        }

        // Gắn kèm thông tin tài khoản (username, password)
        return members.map(m => {
            const user = users.find(u => u.memberId === m.id);
            return {
                ...m,
                hasAccount: !!user,
                userName: user ? user.userName : null,
                password: user ? user.password : null,
                userRole: user ? user.role : null,
                userId: user ? user.id : null
            };
        });
    },

    // Lấy thông tin 1 thành viên theo ID
    getMemberById(memberId) {
        const id = Number(memberId);
        const all = this.getAllMembers();
        return all.find(m => m.id === id) || null;
    },

    // Lấy danh sách thành viên đang hoạt động
    getActiveMembers() {
        return this.getAllMembers().filter(m => m.isActive);
    },

    // Thêm mới thành viên (hỗ trợ cả dạng object hoặc tham số rời)
    addMember(param1, param2, param3, param4) {
        let fullName = "";
        let department = "";
        let userName = "";
        let password = "";

        if (typeof param1 === "object" && param1 !== null) {
            fullName = param1.fullName || "";
            department = param1.department || "";
            userName = param1.userName || "";
            password = param1.password || "";
        } else {
            fullName = param1 || "";
            department = param2 || "";
            userName = param3 || "";
            password = param4 || "";
        }

        const name = (fullName || "").trim();
        if (!name) {
            return {
                success: false,
                message: "Vui lòng nhập họ và tên thành viên!"
            };
        }

        const cleanUserName = (userName || "").trim();
        const cleanPassword = (password || "").trim();
        const users = DB.getUsers();

        // Kiểm tra nếu có nhập username thì kiểm tra trùng lặp
        if (cleanUserName) {
            const userExists = users.some(u => u.userName.toLowerCase() === cleanUserName.toLowerCase());
            if (userExists) {
                return {
                    success: false,
                    message: `Tên tài khoản "${cleanUserName}" đã tồn tại! Vui lòng chọn tên tài khoản khác.`
                };
            }
        }

        const members = DB.getMembers();
        const newId = members.length > 0 ? Math.max(...members.map(m => m.id || 0)) + 1 : 1;

        const newMember = {
            id: newId,
            fullName: name,
            department: (department || "").trim(),
            isActive: true
        };

        members.push(newMember);

        // Tạo tài khoản người dùng nếu có cung cấp username
        if (cleanUserName) {
            const newUser = {
                id: `user_${Date.now()}_${newId}`,
                userName: cleanUserName,
                password: cleanPassword || "Member@12345",
                role: CONFIG.ROLES.MEMBER,
                memberId: newId,
                fullName: name
            };
            users.push(newUser);
            DB.saveUsers(users);
        }

        // Tự động sắp xếp A-Z theo tên và đánh số mã thứ tự từ 1 đến hết
        const reindexed = this.sortAndReindexMembers(members);
        DB.saveMembers(reindexed);

        return {
            success: true,
            member: newMember,
            message: `Đã thêm thành viên "${name}" thành công!`
        };
    },

    // Cập nhật thông tin thành viên (Họ và tên, Phòng/Tổ, Username, Password, Trạng thái)
    updateMember({ id, fullName, department, userName, password, isActive }) {
        const memberId = Number(id);
        const members = DB.getMembers();
        const member = members.find(m => m.id === memberId);

        if (!member) {
            return {
                success: false,
                message: "Không tìm thấy thành viên cần chỉnh sửa!"
            };
        }

        const name = (fullName || "").trim();
        if (!name) {
            return {
                success: false,
                message: "Họ và tên thành viên không được để trống!"
            };
        }

        // Cập nhật thông tin member
        member.fullName = name;
        member.department = (department || "").trim();
        if (typeof isActive === "boolean") {
            member.isActive = isActive;
        }

        // Cập nhật hoặc tạo mới tài khoản user liên kết
        const cleanUserName = (userName || "").trim();
        const cleanPassword = (password || "").trim();
        const users = DB.getUsers();
        let user = users.find(u => u.memberId === memberId);

        if (cleanUserName) {
            // Kiểm tra trùng username với user khác
            const duplicate = users.find(u =>
                u.userName.toLowerCase() === cleanUserName.toLowerCase() &&
                u.memberId !== memberId
            );
            if (duplicate) {
                return {
                    success: false,
                    message: `Tên tài khoản "${cleanUserName}" đã được sử dụng bởi người khác!`
                };
            }

            if (user) {
                user.userName = cleanUserName;
                user.fullName = name;
                if (cleanPassword) {
                    user.password = cleanPassword;
                }
            } else {
                user = {
                    id: `user_${Date.now()}_${memberId}`,
                    userName: cleanUserName,
                    password: cleanPassword || "Member@12345",
                    role: CONFIG.ROLES.MEMBER,
                    memberId: memberId,
                    fullName: name
                };
                users.push(user);
            }
            DB.saveUsers(users);
        } else if (cleanPassword && user) {
            user.fullName = name;
            user.password = cleanPassword;
            DB.saveUsers(users);
        } else if (user) {
            user.fullName = name;
            DB.saveUsers(users);
        }

        // Tự động sắp xếp lại theo A-Z của tên và cập nhật mã thứ tự 1..N
        const reindexed = this.sortAndReindexMembers(members);
        DB.saveMembers(reindexed);

        // Cập nhật phiên đăng nhập nếu chính người dùng đang đăng nhập là thành viên này
        const currentUser = AuthService.getCurrentUser();
        if (currentUser && currentUser.memberId === memberId) {
            currentUser.fullName = name;
            if (user) {
                currentUser.userName = user.userName;
            }
            DB.set(CONFIG.STORAGE_KEYS.CURRENT_USER, currentUser);
        }

        return {
            success: true,
            member,
            message: `Đã cập nhật thông tin thành viên "${name}" thành công!`
        };
    },

    // Thêm nhiều thành viên cùng lúc từ danh sách văn bản (mỗi dòng một tên hoặc "Tên - Phòng/Tổ")
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

        lines.forEach(line => {
            currentMaxId++;
            let name = line;
            let dept = "";
            if (line.includes("-")) {
                const parts = line.split("-");
                name = parts[0].trim();
                dept = parts.slice(1).join("-").trim();
            } else if (line.includes(",")) {
                const parts = line.split(",");
                name = parts[0].trim();
                dept = parts.slice(1).join(",").trim();
            }
            members.push({
                id: currentMaxId,
                fullName: name,
                department: dept,
                isActive: true
            });
            addedCount++;
        });

        // Sắp xếp lại A-Z theo tên và đánh số mã 1..N
        const reindexed = this.sortAndReindexMembers(members);
        DB.saveMembers(reindexed);

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
        const members = this.getAllMembers();
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
    // Tự động đánh số lại mã các thành viên còn lại từ 1 đến hết theo thứ tự A-Z
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

        // 1. Xóa thành viên khỏi danh sách members, sau đó sắp xếp lại A-Z theo tên & đánh số mã 1..N
        const remainingMembers = members.filter(m => m.id !== id);
        const reindexedMembers = this.sortAndReindexMembers(remainingMembers);
        DB.saveMembers(reindexedMembers);

        // 2. Xóa tài khoản người dùng liên kết trong users
        const users = DB.getUsers();
        const relatedUsers = users.filter(u => u.memberId === id);
        const remainingUsers = users.filter(u => u.memberId !== id);
        DB.saveUsers(remainingUsers);

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
            message: `Đã xóa vĩnh viễn thành viên "${member.fullName}" cùng toàn bộ dữ liệu liên quan! Mã các thành viên đã được cập nhật lại từ 1.`
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
