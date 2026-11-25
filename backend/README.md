# 🚀 Backend IoT — Kết Nối ESP32 & Web Dashboard

Hệ thống Backend phục vụ cho đề tài môn học **IoT và Ứng dụng** (Bài Thực Hành 3) của sinh viên **Nguyễn Thị Ngọc Anh (B23DCAT015)**.

Backend được thiết kế để kết nối trực tiếp với code ESP32 trong thư mục `Bai_Thuc_Hanh_2/Phan_Cung/src/main.cpp` thông qua giao thức **MQTT** trên broker `broker.hivemq.com:1883`.

---

## 📌 1. Các Topic MQTT Kết Nối với ESP32

| Topic | Hướng truyền | Payload JSON | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| `ssdata` | ESP32 ➔ Backend | `{"tem": 28.5, "humid": 70.0, "lux": 450.0, "gas": 320.0}` | Dữ liệu đo từ DHT11, BH1750 và Cảm biến Khí Gas (mỗi 3 giây) |
| `dvcontrol` | Backend ➔ ESP32 | `{"led4": true}` hoặc `{"led4_auto": true}` | Lệnh điều khiển bật/tắt relay đèn (hỗ trợ led1, led2, led3, led4) |
| `dvrespond` | ESP32 ➔ Backend | `{"LED1": "ON", "LED2": "OFF", "LED3": "OFF", "LED4": "OFF"}` | Xác nhận trạng thái thực tế (Hardware ACK) |

---

## 🏃 2. Cách Khởi Chạy Backend

### Yêu cầu:
- Node.js version 18+ (khuyến nghị Node 20 hoặc 24).

### Lệnh chạy:
1. Mở Terminal và di chuyển vào thư mục backend:
   ```bash
   cd backend
   ```
2. Khởi chạy server:
   ```bash
   npm start
   ```
   *(hoặc `npm run dev` để tự động khởi động lại khi sửa code)*.

Server sẽ chạy tại địa chỉ: **`http://localhost:5050`**

---

## 🧪 3. Thử Nghiệm Khi Không Có Mạch ESP32 Thật

Nếu đang ở trên lớp hoặc lúc vấn đáp mà không cắm mạch ESP32 thật vào máy tính, bạn có thể mở một Terminal thứ hai và chạy script mô phỏng:
```bash
cd backend
node simulate-esp32.js
```
Script này sẽ giả lập phát các gói tin cảm biến và phản hồi lại lệnh điều khiển y như vi điều khiển ESP32 thật.

---

## 🌐 4. Danh Sách Các REST API

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Kiểm tra trạng thái MQTT, database và số bản ghi |
| `GET` | `/api/sensors/latest` | Lấy giá trị nhiệt độ, độ ẩm, ánh sáng mới nhất |
| `GET` | `/api/sensors/history` | Lấy danh sách lịch sử đo đạc cảm biến (hỗ trợ `?page=1&limit=10&type=...`) |
| `GET` | `/api/sensors/chart` | Lấy 15 điểm đo gần nhất format cho biểu đồ Recharts |
| `GET` | `/api/actions/history` | Lấy danh sách nhật ký điều khiển & phản hồi phần cứng ACK |
| `POST` | `/api/control` | Gửi lệnh bật/tắt thiết bị xuống ESP32 |

### Body mẫu gửi `POST /api/control`:
```json
{
  "device": "led1",
  "action": true,
  "performedBy": "Người dùng (Ngọc Anh)"
}
```
*(Hỗ trợ `led1`, `led2`, `led3`, `led4`).*

---

## 💾 5. Cơ Sở Dữ Liệu MySQL

Dữ liệu được lưu trữ tự động vào cơ sở dữ liệu **MySQL** (`ecoliving_iot` trên XAMPP `127.0.0.1:3306`, khởi tạo qua [schema.sql](./schema.sql)), gồm đúng 5 bảng chuẩn hóa:
- `User`: Thông tin tài khoản quản trị & hồ sơ sinh viên thực hiện (`admin`, `B23DCAT015`).
- `Devices`: Danh mục 3 thiết bị đầu ra ESP32-C3 (`Điều hòa (LED 1)`, `Quạt thông gió (LED 2)`, `Đèn chiếu sáng (LED 3)`).
- `Sensors`: Danh mục 3 kênh cảm biến (`DHT11 (Nhiệt độ)`, `DHT11 (Độ ẩm)`, `BH1750 (Ánh sáng)`).
- `DataSensor`: Lưu toàn bộ chuỗi dữ liệu đo cảm biến gửi từ ESP32 qua topic `ssdata`.
- `Action_history`: Lưu vết lịch sử gửi lệnh điều khiển và thời gian phản hồi phần cứng (Hardware ACK latency).
