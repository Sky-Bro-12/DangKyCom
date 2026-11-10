/**
 * config.js - Các hằng số cấu hình hệ thống đăng ký cơm
 */

const CONFIG = {
    APP_NAME: "Hệ Thống Đăng Ký Cơm",
    VERSION: "2.0-Frontend",

    // Vai trò người dùng
    ROLES: {
        ADMIN: "Admin",
        MEMBER: "Member"
    },

    // Các bữa ăn trong ngày
    MEAL_TYPES: {
        BREAKFAST: {
            id: 0,
            key: "Breakfast",
            name: "Bữa sáng",
            mealTime: "06:30",
            deadline: "03:30",
            deadlineHour: 3,
            deadlineMinute: 30,
            reminderEnd: "06:30",
            reminderEndHour: 6,
            reminderEndMinute: 30,
            badgeClass: "bg-success",
            cardBorder: "border-success"
        },
        LUNCH: {
            id: 1,
            key: "Lunch",
            name: "Bữa trưa",
            mealTime: "11:00",
            deadline: "08:00",
            deadlineHour: 8,
            deadlineMinute: 0,
            reminderEnd: "11:00",
            reminderEndHour: 11,
            reminderEndMinute: 0,
            badgeClass: "bg-primary",
            cardBorder: "border-primary"
        },
        DINNER: {
            id: 2,
            key: "Dinner",
            name: "Bữa chiều",
            mealTime: "17:00",
            deadline: "14:00",
            deadlineHour: 14,
            deadlineMinute: 0,
            reminderEnd: "17:00",
            reminderEndHour: 17,
            reminderEndMinute: 0,
            badgeClass: "bg-warning text-dark",
            cardBorder: "border-warning"
        }
    },

    // Trạng thái đăng ký cơm
    MEAL_STATUS: {
        ON_TIME: {
            id: 0,
            key: "OnTime",
            name: "Ăn đúng giờ",
            badgeClass: "bg-success text-white"
        },
        NO_MEAL: {
            id: 1,
            key: "NoMeal",
            name: "Không ăn",
            badgeClass: "bg-secondary text-white"
        },
        AFTER_MEAL: {
            id: 2,
            key: "AfterMeal",
            name: "Ăn sau",
            badgeClass: "bg-warning text-dark"
        },
        NOT_REGISTERED: {
            id: 3,
            key: "NotRegistered",
            name: "Chưa đăng ký - Quá hạn",
            badgeClass: "bg-danger text-white"
        }
    },

    // Các khóa lưu trữ LocalStorage
    STORAGE_KEYS: {
        MEMBERS: "meal_app_members",
        USERS: "meal_app_users",
        REGISTRATIONS: "meal_app_registrations",
        HISTORIES: "meal_app_histories",
        CURRENT_USER: "meal_app_current_user",
        SIMULATED_TIME: "meal_app_simulated_time",
        SIMULATION_ACTIVE: "meal_app_simulation_active"
    }
};

// Helper lấy thông tin MealType theo id hoặc key
function getMealTypeInfo(type) {
    if (typeof type === "number") {
        return Object.values(CONFIG.MEAL_TYPES).find(m => m.id === type) || CONFIG.MEAL_TYPES.BREAKFAST;
    }
    return CONFIG.MEAL_TYPES[type?.toUpperCase()] ||
        Object.values(CONFIG.MEAL_TYPES).find(m => m.key === type) ||
        CONFIG.MEAL_TYPES.BREAKFAST;
}

// Helper lấy thông tin MealStatus theo id hoặc key
function getMealStatusInfo(status) {
    if (typeof status === "number") {
        return Object.values(CONFIG.MEAL_STATUS).find(s => s.id === status) || CONFIG.MEAL_STATUS.NOT_REGISTERED;
    }
    return CONFIG.MEAL_STATUS[status?.toUpperCase()] ||
        Object.values(CONFIG.MEAL_STATUS).find(s => s.key === status) ||
        CONFIG.MEAL_STATUS.NOT_REGISTERED;
}
