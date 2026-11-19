# Tài Liệu Đặc Tả API Hệ Thống EcoLiving Smart Home

> **Học phần:** IoT và Ứng dụng  
> **Đơn vị:** Học viện Công nghệ Bưu chính Viễn thông (PTIT)  
> **Sinh viên thực hiện:** Nguyễn Thị Ngọc Anh — **Mã SV:** `B23DCAT015`  
> **Môi trường Backend:** Node.js Express + MQTT (HiveMQ) + MySQL  
> **Địa chỉ máy chủ (Base URL):** `http://localhost:5050`  

---

## 1. Tổng Quan Kiến Trúc API & Cơ Chế Xác Thực

Hệ thống API backend của EcoLiving cung cấp toàn bộ các điểm cuối (endpoints) phục vụ 4 nghiệp vụ cốt lõi:
1. **Xác thực & Bảo mật (Authentication):** Đăng nhập cấp mã khóa phiên làm việc dạng chữ ký HMAC-SHA256 (`api_key`) và thu hồi khi đăng xuất.
2. **Giám sát thời gian thực (Dashboard & Sensors):** Lấy dữ liệu cảm biến DHT11 (Nhiệt độ, Độ ẩm) và BH1750 (Ánh sáng), phục vụ vẽ đồ thị và cảnh báo ngưỡng nguy hiểm.
3. **Quản lý dữ liệu lịch sử (DataSensor History):** Hỗ trợ tìm kiếm từ khóa, lọc theo loại cảm biến, sắp xếp đa chiều và phân trang dữ liệu lớn.
4. **Điều khiển thiết bị & Đo độ trễ phần cứng (Device Control & Action History):** Gửi lệnh điều khiển MQTT đến chân GPIO vi điều khiển ESP32 và tính toán chính xác độ trễ phản hồi phần cứng (Hardware Response Time / ACK).

### Cơ chế xác thực (Authentication)
Sau khi gọi API `/api/login` thành công, client nhận được chuỗi token `api_key` có tiền tố `eco_...`. Mọi yêu cầu tiếp theo cần đính kèm token này theo một trong hai cách:
* **Header (Khuyến nghị):** `x-api-key: <api_key>`
* **Query Parameter:** `?api_key=<api_key>`

---

## 2. Biến Môi Trường Postman (Environment Variables)

File cấu hình môi trường Postman đi kèm: `postman/EcoLiving_Local.postman_environment.json`.

| Tên biến | Giá trị mẫu | Mô tả |
| :--- | :--- | :--- |
| `base_url` | `http://localhost:5050` | Địa chỉ Backend Server |
| `api_key` | `eco_...` | Tự động lưu sau khi chạy request Đăng nhập |
| `den` | `led3` | Khóa định danh Đèn chiếu sáng (GPIO 7) |
| `quat` | `led2` | Khóa định danh Quạt thông gió (GPIO 6) |
| `dieuhoa` | `led1` | Khóa định danh Điều hòa (GPIO 5) |

---

## 3. Danh Mục Chi Tiết Các Điểm Cuối (API Endpoints)

### Nhóm 1: Xác Thực & Người Dùng (Authentication)

#### 1.1. Đăng nhập hệ thống (Lấy API Key)
* **Endpoint:** `POST /api/login`
* **Xác thực:** Không yêu cầu
* **Content-Type:** `application/json` hoặc `application/x-www-form-urlencoded`
* **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "123"
  }
  ```
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "message": "Đăng nhập thành công.",
    "api_key": "eco_eyJ1aWQiOjEsInUiOiJhZG1pbiIsImlhdCI6MTc2MzUzOTIwMDAwMCwianRpIjoiYTFmOTJjMDkifQ.xYz...",
    "user": {
      "user_id": 1,
      "username": "admin",
      "full_name": "Nguyễn Thị Ngọc Anh",
      "student_id": "B23DCAT015",
      "role": "admin"
    }
  }
  ```
* **Postman Test Script tự động lưu API Key:**
  ```javascript
  pm.test("Status code is 200", function () {
      pm.response.to.have.status(200);
  });
  const data = pm.response.json();
  if (data.api_key) {
      pm.environment.set("api_key", data.api_key);
  }
  ```

#### 1.2. Đăng xuất hệ thống (Thu hồi API Key)
* **Endpoint:** `POST /api/logout`
* **Xác thực:** Bắt buộc (`x-api-key`)
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "message": "Đăng xuất thành công. API key đã được thu hồi."
  }
  ```

#### 1.3. Lấy thông tin tài khoản hiện tại
* **Endpoint:** `GET /api/me`
* **Xác thực:** Bắt buộc (`x-api-key`)
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "user_id": 1,
      "username": "admin",
      "full_name": "Nguyễn Thị Ngọc Anh",
      "student_id": "B23DCAT015",
      "class_name": "Khóa 2023 - 2028",
      "role": "admin"
    }
  }
  ```

---

### Nhóm 2: Giám Sát Trạng Thái & Cảm Biến Thời Gian Thực

#### 2.1. Kiểm tra trạng thái máy chủ (Healthcheck)
* **Endpoint:** `GET /api/status`
* **Xác thực:** Không yêu cầu
* **Response Thành công (200 OK):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-11-19 14:45:00",
    "mqtt": {
      "connected": true,
      "broker": "mqtt://broker.hivemq.com:1883",
      "topics": {
        "sensor": "ssdata",
        "control": "dvcontrol",
        "respond": "dvrespond"
      }
    },
    "database": {
      "connected": true,
      "name": "ecoliving_iot"
    }
  }
  ```

#### 2.2. Lấy số liệu tổng quan Dashboard
* **Endpoint:** `GET /api/dashboard`
* **Xác thực:** Bắt buộc (`x-api-key`)
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "latest_sensors": {
      "temperature": { "value": 28.0, "unit": "°C", "alert": "NORMAL" },
      "humidity": { "value": 91.0, "unit": "%", "alert": "DANGER" },
      "light": { "value": 259, "unit": "Lux", "alert": "NORMAL" }
    },
    "devices_summary": {
      "total": 3,
      "active_count": 1
    },
    "system_alert": "Cảnh báo độ ẩm rất cao: Độ ẩm đạt 91.0% (> 85%)."
  }
  ```

#### 2.3. Lấy dữ liệu cảm biến mới nhất
* **Endpoint:** `GET /api/sensors/latest`
* **Xác thực:** Bắt buộc (`x-api-key`)
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "temperature": 28.0,
    "humidity": 91.0,
    "light": 259,
    "timestamp": "2026-11-19 14:45:10"
  }
  ```

#### 2.4. Lấy dữ liệu chuỗi thời gian vẽ biểu đồ (Chart Data)
* **Endpoint:** `GET /api/sensors/chart?range=hour`
* **Query Params:**
  * `range`: `hour` (1 giờ gần nhất), `day` (24 giờ), hoặc `week` (7 ngày).
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "range": "hour",
    "points": [
      { "time": "14:40:00", "temperature": 27.8, "humidity": 90.5, "light": 260 },
      { "time": "14:45:00", "temperature": 28.0, "humidity": 91.0, "light": 259 }
    ]
  }
  ```

---

### Nhóm 3: Lịch Sử Dữ Liệu Cảm Biến (DataSensor)

#### 3.1. Tra cứu, tìm kiếm và phân trang dữ liệu đo đạc
* **Endpoint:** `GET /api/sensors/history`
* **Query Params:**
  * `page` (int, default: 1): Trang hiện tại.
  * `limit` (int, default: 10): Số bản ghi trên mỗi trang.
  * `sensor_type` (string, optional): `TEMPERATURE` | `HUMIDITY` | `LIGHT`.
  * `search` (string, optional): Tìm kiếm giá trị đo đạc (ví dụ: `27`).
  * `sort_by` (string, default: `data_id`): Cột sắp xếp (`data_id`, `timestamp`, `value`).
  * `sort_order` (string, default: `DESC`): `ASC` hoặc `DESC`.
* **Ví dụ gọi:** `GET /api/sensors/history?sensor_type=TEMPERATURE&search=27&page=1&limit=10`
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "pagination": {
      "total_records": 11550,
      "page": 1,
      "limit": 10,
      "total_pages": 1155
    },
    "data": [
      {
        "data_id": 11550,
        "sensor_name": "DHT11 (Nhiệt độ)",
        "sensor_type": "TEMPERATURE",
        "value": 27.0,
        "unit": "°C",
        "alert_status": "NORMAL",
        "timestamp": "2026-11-19 14:45:02"
      }
    ]
  }
  ```

---

### Nhóm 4: Điều Khiển Thiết Bị & Ngoại Vi (Hardware Control)

#### 4.1. Lấy danh sách thiết bị chấp hành
* **Endpoint:** `GET /api/devices`
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "devices": [
      {
        "device_id": 1,
        "device_name": "Điều hòa (LED 1)",
        "device_key": "led1",
        "gpio_pin": "GPIO 5",
        "status": "OFF",
        "mode": "MANUAL"
      },
      {
        "device_id": 2,
        "device_name": "Quạt thông gió (LED 2)",
        "device_key": "led2",
        "gpio_pin": "GPIO 6",
        "status": "ON",
        "mode": "MANUAL"
      },
      {
        "device_id": 3,
        "device_name": "Đèn chiếu sáng (LED 3)",
        "device_key": "led3",
        "gpio_pin": "GPIO 7",
        "status": "OFF",
        "mode": "MANUAL"
      }
    ]
  }
  ```

#### 4.2. Gửi lệnh điều khiển bật/tắt thiết bị
* **Endpoint:** `POST /api/control`
* **Xác thực:** Bắt buộc (`x-api-key`)
* **Request Body:**
  ```json
  {
    "device_key": "led2",
    "action_type": "ON",
    "mode": "MANUAL"
  }
  ```
  *(Hoặc dùng `device_id: 2`, `action: "ON"`).*
* **Luồng xử lý backend:**
  1. Ghi nhận thời gian gửi lệnh (`activation_time`).
  2. Xuất bản bản tin MQTT xuống topic `dvcontrol`: `{"device_id": 2, "action": "ON", "mode": "MANUAL"}`.
  3. Chờ phản hồi ACK từ vi điều khiển ESP32 trên topic `dvrespond`.
  4. Tính toán độ trễ phản hồi phần cứng: `latency_ms = response_time - activation_time`.
  5. Cập nhật trạng thái vào bảng `Devices` và lưu lịch sử vào `Action_history`.
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "message": "Điều khiển thiết bị Quạt thông gió (LED 2) thành công.",
    "action_id": 182,
    "device_id": 2,
    "status": "ON",
    "activation_time": "2026-11-19 14:45:00.120",
    "response_time": "2026-11-19 14:45:00.620",
    "latency_seconds": 0.50
  }
  ```

---

### Nhóm 5: Nhật Ký Thao Tác & Độ Trễ Phản Hồi (Action History)

#### 5.1. Tra cứu lịch sử thao tác điều khiển thiết bị
* **Endpoint:** `GET /api/actions/history`
* **Query Params:**
  * `page` (int, default: 1): Trang hiện tại.
  * `limit` (int, default: 10): Số bản ghi trên trang.
  * `device_id` (int, optional): Lọc theo ID thiết bị (`1`, `2`, `3`).
  * `status` (string, optional): `ON` hoặc `OFF`.
  * `search` (string, optional): Tìm kiếm theo tên thiết bị hoặc thời gian.
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "pagination": {
      "total_records": 182,
      "page": 1,
      "limit": 10,
      "total_pages": 19
    },
    "data": [
      {
        "id": "#ACT-182",
        "device_name": "Quạt thông gió (LED 2)",
        "action_type": "BẬT",
        "status": "BẬT",
        "activation_time": "2026-11-19 10:59:58",
        "response_time": "2026-11-19 10:59:58 (0.50s)",
        "latency_seconds": 0.50,
        "mode": "MANUAL"
      }
    ]
  }
  ```

---

## 4. Hướng Dẫn Sử Dụng Trong Phần Mềm Postman

1. **Khởi động Postman:** Mở ứng dụng Postman trên máy tính.
2. **Import Collection & Environment:**
   * Bấm nút **Import** ở góc trên cùng bên trái.
   * Chọn 2 file từ thư mục `postman/`:
     - `postman/PTIT_IoT.postman_collection.json`
     - `postman/EcoLiving_Local.postman_environment.json`
3. **Chọn Environment:** Ở góc trên cùng bên phải Postman, chọn môi trường **EcoLiving Local**.
4. **Trình tự chạy test chuẩn:**
   * **Bước 1:** Chạy request `Đăng nhập (lấy API key)` $\to$ Test script sẽ tự động gán token vào biến `{{api_key}}`.
   * **Bước 2:** Chạy các request trong mục `Điều khiển` (`Bật quạt`, `Tắt quạt`, `Bật đèn`, `Bật điều hòa`).
   * **Bước 3:** Chạy các request trong mục `Xem dữ liệu` (`Số liệu Dashboard`, `Dữ liệu cảm biến`, `Lịch sử thao tác`).
   * **Bước 4:** Chạy request `Đăng xuất` $\to$ Thu hồi API Key.
   * **Bước 5:** Chạy request `Thử gọi không có API key (401)` $\to$ Postman kiểm tra mã `401 Unauthorized` để xác thực hệ thống bảo mật chặt chẽ.

---
*Khoa An toàn Thông tin — Học viện Công nghệ Bưu chính Viễn thông.*

