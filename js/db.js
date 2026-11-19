/**
 * db.js - Tầng lưu trữ dữ liệu đa tầng (Hybrid Data Layer)
 * 
 * Hỗ trợ đồng thời:
 * 1. Google Firebase Firestore (Chế độ Cloud Realtime Đa người dùng - Multi-user)
 * 2. LocalStorage Cache (Dự phòng Offline, khởi động tức thì không độ trễ)
 */

const DB = {
    firestore: null,
    isCloudReady: false,
    unsubscribers: [],

    // ==========================================
    // 1. TẦNG BỘ NHỚ ĐỆM CỤC BỘ (LOCAL CACHE)
    // ==========================================
    get(key, defaultValue = []) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error(`Lỗi khi đọc ${key} từ localStorage:`, e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Lỗi khi ghi ${key} vào localStorage:`, e);
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    // ==========================================
    // 2. CÁC HÀM TRUY XUẤT THỰC THỂ
    // ==========================================
    getMembers() {
        return this.get(CONFIG.STORAGE_KEYS.MEMBERS, []);
    },

    saveMembers(members) {
        const ok = this.set(CONFIG.STORAGE_KEYS.MEMBERS, members);
        if (this.isCloudReady) {
            this.pushCollectionToCloud("members", members);
        }
        return ok;
    },

    getUsers() {
        return this.get(CONFIG.STORAGE_KEYS.USERS, []);
    },

    saveUsers(users) {
        const ok = this.set(CONFIG.STORAGE_KEYS.USERS, users);
        if (this.isCloudReady) {
            this.pushCollectionToCloud("users", users);
        }
        return ok;
    },

    getRegistrations() {
        return this.get(CONFIG.STORAGE_KEYS.REGISTRATIONS, []);
    },

    saveRegistrations(regs) {
        const ok = this.set(CONFIG.STORAGE_KEYS.REGISTRATIONS, regs);
        if (this.isCloudReady) {
            this.pushCollectionToCloud("registrations", regs);
        }
        return ok;
    },

    getHistories() {
        return this.get(CONFIG.STORAGE_KEYS.HISTORIES, []);
    },

    saveHistories(histories) {
        const ok = this.set(CONFIG.STORAGE_KEYS.HISTORIES, histories);
        if (this.isCloudReady) {
            this.pushCollectionToCloud("histories", histories);
        }
        return ok;
    },

    // ==========================================
    // 3. TÍCH HỢP CLOUD FIREBASE FIRESTORE
    // ==========================================
    initFirebase() {
        if (!isFirebaseConfigured()) {
            console.info("💡 Firebase chưa được cấu hình. Hệ thống đang hoạt động ở chế độ LocalStorage cục bộ.");
            this.updateCloudStatusBadge(false);
            return;
        }

        if (typeof firebase === "undefined") {
            console.warn("⚠️ Firebase SDK chưa được tải từ CDN.");
            this.updateCloudStatusBadge(false);
            return;
        }

        try {
            // Khởi tạo Firebase nếu chưa có
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            this.firestore = firebase.firestore();

            // Kích hoạt Offline Persistence của Firestore
            this.firestore.enablePersistence({ synchronizeTabs: true }).catch(err => {
                if (err.code === "failed-precondition") {
                    console.warn("Nhiều tab đang mở, persistence chỉ bật trên 1 tab.");
                } else if (err.code === "unimplemented") {
                    console.warn("Trình duyệt không hỗ trợ offline persistence.");
                }
            });

            this.isCloudReady = true;
            console.log("🔥 Đã kết nối thành công Google Firebase Firestore!");
            this.updateCloudStatusBadge(true);

            // Bắt đầu lắng nghe dữ liệu thời gian thực (Realtime listeners)
            this.startRealtimeSync();

        } catch (error) {
            console.error("Lỗi khởi tạo Firebase:", error);
            this.isCloudReady = false;
            this.updateCloudStatusBadge(false);
        }
    },

    // Lắng nghe dữ liệu thay đổi từ Firebase và tự động cập nhật Local Cache
    startRealtimeSync() {
        if (!this.firestore) return;

        const collections = [
            { name: "registrations", key: CONFIG.STORAGE_KEYS.REGISTRATIONS },
            { name: "members", key: CONFIG.STORAGE_KEYS.MEMBERS },
            { name: "users", key: CONFIG.STORAGE_KEYS.USERS },
            { name: "histories", key: CONFIG.STORAGE_KEYS.HISTORIES }
        ];

        collections.forEach(col => {
            const unsub = this.firestore.collection(col.name).onSnapshot(snapshot => {
                if (snapshot.empty && this.get(col.key, []).length > 0) {
                    // Nếu trên Cloud rỗng mà local đã có data mẫu, tự động đẩy lên Cloud
                    console.log(`Cloud [${col.name}] đang trống. Tự động đồng bộ từ Local lên Cloud...`);
                    this.pushCollectionToCloud(col.name, this.get(col.key, []));
                    return;
                }

                if (!snapshot.empty) {
                    const cloudData = [];
                    snapshot.forEach(doc => {
                        cloudData.push(doc.data());
                    });

                    // Lưu vào cache
                    this.set(col.key, cloudData);

                    // Bắn sự kiện để giao diện cập nhật ngay lập tức nếu người dùng đang xem
                    window.dispatchEvent(new CustomEvent("cloud-data-updated", { detail: { collection: col.name } }));

                    if (typeof App !== "undefined" && typeof App.refreshCurrentView === "function") {
                        App.refreshCurrentView();
                    }
                }
            }, err => {
                console.warn(`Lỗi lắng nghe Firestore collection [${col.name}]:`, err);
            });

            this.unsubscribers.push(unsub);
        });
    },

    // Đẩy dữ liệu một collection lên Firestore
    async pushCollectionToCloud(collectionName, items) {
        if (!this.firestore || !this.isCloudReady) return;

        try {
            const batch = this.firestore.batch();
            const colRef = this.firestore.collection(collectionName);

            items.forEach(item => {
                // Xác định Document ID tối ưu
                let docId;
                if (collectionName === "registrations") {
                    docId = `${item.mealDate}_${item.memberId}_${item.mealType}`;
                } else if (collectionName === "users") {
                    docId = item.id ? String(item.id) : (item.userName || String(Math.random()));
                } else if (collectionName === "members") {
                    docId = `member_${item.id}`;
                } else {
                    docId = item.id ? String(item.id) : String(Math.random());
                }

                const docRef = colRef.doc(docId);
                batch.set(docRef, item, { merge: true });
            });

            await batch.commit();
            console.log(`☁️ Đã đồng bộ [${collectionName}] lên Firestore (${items.length} bản ghi).`);
        } catch (e) {
            console.error(`Lỗi khi đẩy ${collectionName} lên Firestore:`, e);
        }
    },

    // Xóa vĩnh viễn dữ liệu thành viên trên Cloud Firestore (Phần cứng đám mây)
    async deleteMemberFromCloud(memberId, userDocIds = [], regDocIds = [], historyDocIds = []) {
        if (!this.firestore || !this.isCloudReady) return;

        try {
            const batch = this.firestore.batch();

            // 1. Xóa document member
            const memberRef = this.firestore.collection("members").doc(`member_${memberId}`);
            batch.delete(memberRef);

            // 2. Xóa các users liên quan
            userDocIds.forEach(uId => {
                const userRef = this.firestore.collection("users").doc(String(uId));
                batch.delete(userRef);
            });

            // 3. Xóa các registrations liên quan
            regDocIds.forEach(rId => {
                const regRef = this.firestore.collection("registrations").doc(String(rId));
                batch.delete(regRef);
            });

            // 4. Xóa các histories liên quan
            historyDocIds.forEach(hId => {
                const histRef = this.firestore.collection("histories").doc(String(hId));
                batch.delete(histRef);
            });

            await batch.commit();
            console.log(`☁️ Đã xóa sạch toàn bộ dữ liệu của thành viên #${memberId} trên Firestore Cloud.`);
        } catch (e) {
            console.error(`Lỗi khi xóa dữ liệu thành viên #${memberId} trên Firestore:`, e);
        }
    },

    // Nút kích hoạt đồng bộ toàn bộ dữ liệu mẫu lên Cloud
    async syncAllToCloud() {
        if (!this.isCloudReady) {
            alert("Vui lòng cấu hình file js/firebase-config.js trước khi đồng bộ lên Cloud!");
            return;
        }
        await this.pushCollectionToCloud("members", this.getMembers());
        await this.pushCollectionToCloud("users", this.getUsers());
        await this.pushCollectionToCloud("registrations", this.getRegistrations());
        await this.pushCollectionToCloud("histories", this.getHistories());
        alert("✅ Đã đồng bộ toàn bộ dữ liệu thành công lên Firebase Firestore!");
    },

    // Cập nhật badge trạng thái kết nối trên Navbar
    updateCloudStatusBadge(isOnline) {
        const badge = document.getElementById("cloudStatusBadge");
        if (!badge) return;

        if (isOnline) {
            badge.className = "badge bg-light text-success border border-success me-2 d-flex align-items-center";
            badge.innerHTML = `<span class="spinner-grow spinner-grow-sm me-1 text-success" style="width: 0.5rem; height: 0.5rem;"></span> Cloud Firestore Online`;
            badge.title = "Đang kết nối cơ sở dữ liệu đám mây Google Firebase. Dữ liệu được đồng bộ Realtime!";
        } else {
            badge.className = "badge bg-warning text-dark me-2 d-flex align-items-center";
            badge.innerHTML = `💾 LocalStorage (Chưa nối Cloud)`;
            badge.title = "Dữ liệu đang lưu trên máy này. Điền firebase-config.js để kết nối Cloud dùng cho 100 người.";
            badge.style.cursor = "pointer";
            badge.onclick = () => {
                if (typeof App !== "undefined" && typeof App.showCloudGuideModal === "function") {
                    App.showCloudGuideModal();
                }
            };
        }
    },

    // ==========================================
    // 4. KHỞI TẠO VÀ SEED DỮ LIỆU BAN ĐẦU
    // ==========================================
    initDatabase(force = false) {
        const existingUsers = this.getUsers();
        if (existingUsers.length > 0 && !force) {
            // Đã có dữ liệu trong LocalStorage
            this.initFirebase();
            return;
        }

        console.log("Khởi tạo dữ liệu mẫu ban đầu cho Hệ Thống Đăng Ký Cơm...");

        // 1. Danh sách Thành viên mẫu (Khởi tạo sẵn 10 thành viên)
        const initialMembers = [
            { id: 1, code: 1, fullName: "Nguyễn Văn An", department: "Phòng Kỹ thuật", isActive: true },
            { id: 2, code: 2, fullName: "Trần Thị Bình", department: "Phòng Kế toán", isActive: true },
            { id: 3, code: 3, fullName: "Lê Hoàng Cường", department: "Phòng Kinh doanh", isActive: true },
            { id: 4, code: 4, fullName: "Phạm Minh Đức", department: "Phòng Nhân sự", isActive: true },
            { id: 5, code: 5, fullName: "Võ Thị Em", department: "Phòng Kỹ thuật", isActive: true },
            { id: 6, code: 6, fullName: "Đặng Quốc Hưng", department: "Phòng Marketing", isActive: true },
            { id: 7, code: 7, fullName: "Bùi Thị Mai", department: "Phòng Kế toán", isActive: true },
            { id: 8, code: 8, fullName: "Hoàng Văn Nam", department: "Phòng Kỹ thuật", isActive: true },
            { id: 9, code: 9, fullName: "Đỗ Thu Trang", department: "Phòng Kinh doanh", isActive: true },
            { id: 10, code: 10, fullName: "Ngô Quang Tuấn", department: "Ban Giám đốc", isActive: true }
        ];
        this.set(CONFIG.STORAGE_KEYS.MEMBERS, initialMembers);

        // 2. Danh sách Tài khoản người dùng mẫu
        const initialUsers = [
            // Quản trị viên
            {
                id: "user_admin",
                userName: "admin",
                password: "Admin@12345",
                role: CONFIG.ROLES.ADMIN,
                memberId: null,
                fullName: "Quản Trị Viên Hệ Thống"
            },
            // Tài khoản Thành viên
            {
                id: "user_an",
                userName: "nguyenvana",
                password: "Member@12345",
                role: CONFIG.ROLES.MEMBER,
                memberId: 1,
                fullName: "Nguyễn Văn An"
            },
            {
                id: "user_binh",
                userName: "tranthib",
                password: "Member@12345",
                role: CONFIG.ROLES.MEMBER,
                memberId: 2,
                fullName: "Trần Thị Bình"
            },
            {
                id: "user_cuong",
                userName: "lehoangcuong",
                password: "Member@12345",
                role: CONFIG.ROLES.MEMBER,
                memberId: 3,
                fullName: "Lê Hoàng Cường"
            }
        ];
        this.set(CONFIG.STORAGE_KEYS.USERS, initialUsers);

        // 3. Đăng ký mẫu cho ngày hôm nay
        const todayStr = TimeSimulator.getTodayString();
        const initialRegistrations = [
            {
                id: 1,
                memberId: 1,
                mealDate: todayStr,
                mealType: CONFIG.MEAL_TYPES.BREAKFAST.id,
                status: CONFIG.MEAL_STATUS.ON_TIME.id,
                registeredAt: new Date().toISOString(),
                lateReason: null
            },
            {
                id: 2,
                memberId: 1,
                mealDate: todayStr,
                mealType: CONFIG.MEAL_TYPES.LUNCH.id,
                status: CONFIG.MEAL_STATUS.ON_TIME.id,
                registeredAt: new Date().toISOString(),
                lateReason: null
            },
            {
                id: 3,
                memberId: 1,
                mealDate: todayStr,
                mealType: CONFIG.MEAL_TYPES.DINNER.id,
                status: CONFIG.MEAL_STATUS.AFTER_MEAL.id,
                registeredAt: new Date().toISOString(),
                lateReason: null
            },
            {
                id: 4,
                memberId: 2,
                mealDate: todayStr,
                mealType: CONFIG.MEAL_TYPES.BREAKFAST.id,
                status: CONFIG.MEAL_STATUS.NO_MEAL.id,
                registeredAt: new Date().toISOString(),
                lateReason: null
            },
            {
                id: 5,
                memberId: 2,
                mealDate: todayStr,
                mealType: CONFIG.MEAL_TYPES.LUNCH.id,
                status: CONFIG.MEAL_STATUS.ON_TIME.id,
                registeredAt: new Date().toISOString(),
                lateReason: null
            },
            {
                id: 6,
                memberId: 3,
                mealDate: todayStr,
                mealType: CONFIG.MEAL_TYPES.LUNCH.id,
                status: CONFIG.MEAL_STATUS.ON_TIME.id,
                registeredAt: new Date().toISOString(),
                lateReason: null
            }
        ];
        this.set(CONFIG.STORAGE_KEYS.REGISTRATIONS, initialRegistrations);

        // 4. Lịch sử mẫu
        const initialHistories = [
            {
                id: 1,
                memberId: 2,
                mealDate: todayStr,
                mealType: CONFIG.MEAL_TYPES.BREAKFAST.id,
                oldStatus: null,
                newStatus: CONFIG.MEAL_STATUS.NO_MEAL.id,
                actorName: "Quản Trị Viên",
                actorUserId: "user_admin",
                actionAt: new Date().toISOString(),
                reason: "Thành viên báo bận đột xuất"
            }
        ];
        this.set(CONFIG.STORAGE_KEYS.HISTORIES, initialHistories);

        // Khởi tạo Firebase sau khi đã có dữ liệu khởi điểm
        this.initFirebase();
    }
};

// Tự động khởi tạo ngay khi tải thư viện
DB.initDatabase();
