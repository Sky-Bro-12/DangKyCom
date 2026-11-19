# 🍚 Hệ Thống Đăng Ký Cơm Hằng Ngày

> **Trang Web Trực Tuyến:** [https://sky-bro-12.github.io/DangKyCom/](https://sky-bro-12.github.io/DangKyCom/)  
> **Kho lưu trữ GitHub:** [https://github.com/Sky-Bro-12/DangKyCom](https://github.com/Sky-Bro-12/DangKyCom)  
> **Kiến trúc:** HTML5 + JavaScript ES6 + Bootstrap 5 + Google Firebase Firestore (BaaS)

---

## 🌟 Tính Năng Nổi Bật

- **Đăng ký cơm 3 bữa:** Sáng (chốt 03:30), Trưa (chốt 08:00), Chiều (chốt 14:00).
- **Hệ thống Nhắc nhở Đa kênh thông minh:**
  - **Đếm ngược thời gian thực:** Đồng hồ đếm ngược từng giây trước giờ khóa và cảnh báo khẩn cấp khi còn < 30 phút.
  - **Thông báo đẩy trình duyệt (Web Notification):** Tự động phát âm thanh chuông báo và gửi popup nhắc nhở trên máy tính / điện thoại.
  - **Trung tâm nhắc nhở Quản trị viên:** Tra cứu ngay lập tức ai chưa đăng ký của từng bữa, 1 cú click để sao chép danh sách đẹp mắt gửi vào nhóm chat Zalo.
  - **Tự động mở nhóm Zalo / Webhook:** Tích hợp gửi thẳng tin nhắn thông báo vào nhóm chat Zalo của đơn vị.
  - **GitHub Actions Cron Scheduler:** Tự động chạy ngầm gửi tin nhắn trước giờ chốt (03:15, 07:45, 13:45).
- **Mã QR Vĩnh Viễn & Thống kê Công Khai:**
  - **Quét xem ngay không cần đăng nhập:** Người ngoài, nhân viên nhà bếp, khách chỉ cần quét mã QR bằng camera điện thoại hoặc Zalo là thấy ngay bảng thống kê số lượng suất ăn mỗi bữa (Sáng, Trưa, Chiều) và danh sách chi tiết người ăn.
  - **Liên kết cố định vĩnh viễn:** `https://sky-bro-12.github.io/DangKyCom/#public-stats`.
  - **Tải ảnh & In biển dán tường:** Tích hợp nút tải ảnh mã QR độ phân giải cao (`qr-thong-ke.png`) và tính năng in biển A4 có khung hướng dẫn dán tại cửa nhà bếp/phòng ăn.
- **Thống kê chuyên nghiệp:** Báo cáo chi tiết số lượng suất ăn theo ngày, xuất file Excel (CSV) và in phiếu báo cáo cho nhà bếp.
- **Quản trị & Phân quyền:**
  - Thành viên tự đăng ký và xem lịch sử của mình.
  - Quản trị viên (Admin) có quyền đăng ký thay (Audit Log lưu vết), nhập danh sách thành viên hàng loạt (Bulk Import) và tự động cấp tài khoản cho 100 thành viên.
- **Thời gian thực (Realtime):** Đồng bộ dữ liệu tức thì giữa điện thoại và máy tính không cần tải lại trang.
- **Chi phí 0 VNĐ:** Chạy hoàn toàn trên GitHub Pages & Firebase Free Tier.

---

## 🚀 Hướng Dẫn Đưa Lên GitHub Pages (Lần Đầu Tiên)

Nếu dùng **Git Bash / Terminal**:
```bash
git init
git remote add origin https://github.com/Sky-Bro-12/DangKyCom.git
git add .
git commit -m "feat: triển khai hệ thống đăng ký cơm"
git branch -M main
git push -u origin main
```

Hoặc dùng **VS Code**:
1. Mở thư mục này bằng VS Code (`File > Open Folder...`).
2. Vào tab **Source Control** (Ctrl + Shift + G) -> Bấm **Publish to GitHub**.
3. Chọn repo `Sky-Bro-12/DangKyCom`.

### Kích hoạt GitHub Pages:
1. Vào [https://github.com/Sky-Bro-12/DangKyCom/settings/pages](https://github.com/Sky-Bro-12/DangKyCom/settings/pages).
2. Tại mục **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **`main`** / Folder: **`/(root)`**
   - Bấm **Save**.
3. Sau 1 phút, trang web sẽ hoạt động tại: **https://sky-bro-12.github.io/DangKyCom/**.

---

## 🔑 Tài Khoản Thử Nghiệm

Hệ thống có sẵn các nút **"Đăng nhập nhanh"** tại màn hình đăng nhập:

| Tên tài khoản | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- |
| `admin` | `Admin@12345` | Quản trị viên (Đăng ký thay, Thống kê, Quản lý thành viên) |
| `nguyenvana` | `Member@12345` | Thành viên (Đăng ký cơm cá nhân, Xem lịch sử) |
| `tranthib` | `Member@12345` | Thành viên |
| `lehoangcuong` | `Member@12345` | Thành viên |

---

## 📁 Cấu Trúc Thư Mục

- `index.html`: Giao diện ứng dụng đơn trang (SPA)
- `css/style.css`: Tùy chỉnh phong cách giao diện
- `js/`:
  - `config.js`: Cấu hình các bữa ăn, giờ chốt, trạng thái
  - `firebase-config.js`: Cấu hình kết nối Google Firebase Firestore
  - `db.js`: Tầng dữ liệu đa tầng (hỗ trợ Firebase Firestore + Fallback LocalStorage)
  - `auth.js`: Đăng nhập, đăng xuất và phân quyền người dùng
  - `mealService.js`: Nghiệp vụ đăng ký cơm, kiểm tra hạn chốt
  - `adminService.js`: Nghiệp vụ đăng ký thay và thống kê suất ăn
  - `memberService.js`: Quản lý 100 thành viên và cấp tài khoản
  - `timeSimulator.js`: Giả lập thời gian thử nghiệm các mốc hạn chốt
  - `scheduler.js`: Dịch vụ quét tự động
  - `app.js`: Điều khiển giao diện chính
