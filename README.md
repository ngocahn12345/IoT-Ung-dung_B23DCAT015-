# EcoLiving — Hệ Thống giám Sát và điều Khiển EcoLiving

> **Học phần:** IoT và Ứng dụng  
> **Đơn vị đào tạo:** Học viện Công nghệ Bưu chính Viễn thông (PTIT)  
> **Sinh viên thực hiện:** Nguyễn Thị Ngọc Anh  
> **Mã sinh viên:** `B23DCAT015` — **Lớp / Khóa:** Khóa 2023 - 2028  
> **Chuyên ngành:** An toàn thông tin  

## 1. Giới thiệu Đề tài
Dự án **EcoLiving Smart Home Hub** là giải pháp phần mềm giao diện web giám sát và điều khiển nhà thông minh theo thời gian thực. Hệ thống kết nối với nút vi điều khiển **ESP32 / ESP32-C3**, thu thập dữ liệu từ các cảm biến môi trường và gửi/nhận lệnh điều khiển các thiết bị ngoại vi thông qua giao thức truyền thông **MQTT**.

### Mục tiêu đề tài:
- **Giám sát môi trường thời gian thực:** Thu thập, hiển thị và phân tích các chỉ số nhiệt độ, độ ẩm và cường độ ánh sáng trong nhà.
- **Điều khiển thiết bị linh hoạt:** Điều khiển trạng thái Bật/Tắt thiết bị chấp hành (Đèn chiếu sáng, Quạt thông gió, Điều hòa) theo 2 chế độ: **Thủ công** và **Tự động**.
- **Trực quan hóa dữ liệu:** Biểu diễn dữ liệu cảm biến dưới dạng đồ thị biến thiên liên tục và bảng dữ liệu lịch sử đo đạc đa chiều.
- **Theo dõi nhật ký & phản hồi phần cứng:** Ghi nhận chính xác thời gian gửi lệnh điều khiển, thời gian phản hồi từ phần cứng và tác nhân thực hiện (Người dùng hoặc Hệ thống kích hoạt tự động theo ngưỡng).
- **Cảnh báo an toàn thông minh:** Tự động phát hiện các trạng thái vượt ngưỡng nguy hiểm và kích hoạt cảnh báo tức thời.

-
## 2. Kiến trúc Hệ thống 

```
   ┌────────────────────────────────────────────────────────┐
   │                    PHẦN CỨNG IOT                       │
   │  ┌────────────────────────┐  ┌──────────────────────┐  │
   │  │   CẢM BIẾN ĐO ĐẠC      │  │ THIẾT BỊ CHẤP HÀNH   │  │
   │  │ - DHT11 (Nhiệt độ/Ẩm)  │  │ - Đèn chiếu sáng     │  │
   │  │ - BH1750 (Ánh sáng)    │  │ - Quạt thông gió     │  │
   │  └───────────┬────────────┘  │ - Điều hòa           │  │
   │              │               └──────────▲───────────┘  │
   │              ▼                          │              │
   │       ┌─────────────────────────────────┴────────┐     │
   │       │         Node Vi điều khiển ESP32         │     │
   │       └──────────────────────┬───────────────────┘     │
   └──────────────────────────────┼─────────────────────────┘
                                  │ MQTT Publish / Subscribe
                                  ▼
   ┌────────────────────────────────────────────────────────┐
   │                  HẠ TẦNG TRUYỀN THÔNG                  │
   │              MQTT Broker / Cloud Database              │
   └──────────────────────────────┬─────────────────────────┘
                                  │ WebSocket / REST API
                                  ▼
   ┌────────────────────────────────────────────────────────┐
   │                 WEB DASHBOARD (CLIENT)                 │
   │  - Bảng điều khiển thời gian thực        │
   │  - Quản lý dữ liệu cảm biến        │
   │  - Nhật ký hoạt động & Phản hồi lệnh     │
   │  -  Hồ sơ cá nhân    │
   └────────────────────────────────────────────────────────┘
```


## 3. Các chức năng chính Của ứng Dụng

Hệ thống được chia thành 4 tab nghiệp vụ chuyên biệt:

### Tab 1: Bảng Điều Khiển 
- **Giám sát cảm biến tức thời:** 
  - Nhiệt độ (°C): Cảm biến DHT11 kèm badge trạng thái (*Bình thường / Cảnh báo / Nguy hiểm*).
  - Độ ẩm (%): Cảm biến DHT11 theo dõi độ ẩm không khí.
  - Ánh sáng (Lux): Cảm biến quang học BH1750.
- **Điều khiển thiết bị:**
  - Điều khiển 3 thiết bị ngoại vi: Quạt thông gió (Fan), Đèn chiếu sáng (Light), Điều hòa (AC).
  - Công tắc chuyển đổi (Switch Toggle) dạng iOS mượt mà.
  - Tùy chọn 2 chế độ: **Thủ công (Manual)** và **Tự động (Auto)**.
- **Biểu đồ thời gian thực (Multi-line Chart):**
  - Trực quan hóa diễn biến đồng thời của Nhiệt độ, Độ ẩm và Ánh sáng qua các mốc thời gian bằng thư viện Recharts.
- **Banner cảnh báo & Notification Center:**
  - Cảnh báo trực quan khi có chỉ số vượt ngưỡng an toàn.
  - Trung tâm thông báo dạng popover hiển thị danh sách cảnh báo và sự kiện gần nhất.
- **Trạng thái kết nối hệ thống:**
  - Kiểm tra trạng thái trực tuyến (Online/Offline) của **MQTT Broker** và **Cơ sở dữ liệu**.

### Tab 2: Dữ Liệu Cảm Biến 
- Bảng hiển thị toàn bộ lịch sử đo đạc từ các phòng.
- Các trường thông tin: Mã bản ghi, Loại cảm biến, Vị trí phòng, Giá trị đo, Đơn vị, Thời gian thu thập (Timestamp), Mức độ trạng thái, MQTT Topic.
- **Tính năng nâng cao:**
  - Tìm kiếm linh hoạt theo từ khóa, phòng hoặc topic.
  - Bộ lọc kết hợp theo loại cảm biến (Nhiệt độ, Độ ẩm, Ánh sáng) và mức cảnh báo.
  - Sắp xếp tăng/giảm theo cột thời gian hoặc giá trị đo.
  - Phân trang tùy chọn (10, 20, 50 bản ghi/trang) với điều hướng trang tiện lợi.

### Tab 3: Nhật Ký Hoạt Động 
- Theo dõi toàn bộ lịch sử gửi lệnh điều khiển thiết bị:
  - Mã hành động, Tên thiết bị, Lệnh thực hiện (BẬT / TẮT).
  - **Thời gian gửi lệnh (`sentTime`)** và **Thời gian phản hồi phần cứng (`responseTime` - Hardware ACK)** để đo độ trễ mạng.
  - Phân định rõ nguồn thực hiện: **Người dùng thao tác** hay **Hệ thống tự động kích hoạt** (kèm điều kiện kích hoạt cụ thể).
  - Trạng thái lệnh: Thành công (ON/OFF), Đang xử lý (LOADING), Thất bại.
- Hỗ trợ tìm kiếm, lọc theo thiết bị, loại hành động và trạng thái thực thi.

###  Tab 4: Hồ Sơ Cá Nhân 
- Hiển thị đầy đủ thông tin sinh viên thực hiện đề tài (Họ tên, MSV, Khoa/Chuyên ngành, Lớp, Trường PTIT).
- Danh mục kỹ năng phần cứng & phần mềm
- Tích hợp liên kết tài liệu dự án:
  - 🎨 **Figma UI/UX Design**
  - 💻 **Mã nguồn GitHub**
  - 📑 **Tài liệu API (Postman)**
  - 📄 **Tải lên & Xem trước Tệp Báo Cáo Đề Tài (PDF)**
- Cho phép chỉnh sửa, cập nhật thông tin cá nhân và lưu trữ trực tiếp.

---

##  4. Công Nghệ Sử Dụng 

| Thành phần | Công nghệ / Thư viện | Vai trò |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19** + **TypeScript** | Xây dựng giao diện người dùng tương tác cao, kiểu dữ liệu an toàn |
| **Routing & SSR** | **TanStack Start** / **TanStack Router** | Điều hướng file-based routing hiện đại, tối ưu hiệu năng render |
| **Bundler & Build Tool** | **Vite 8** | Môi trường phát triển và đóng gói ứng dụng tốc độ cao |
| **Styling & Theme** | **Tailwind CSS v4** + **tw-animate-css** | Thiết kế giao diện hiện đại, tối giản theo phong cách Glassmorphism |
| **UI Components** | **Radix UI** + **Lucide React Icons** | Bộ thành phần giao diện accessible (Switch, Popover, Dialog,...) |
| **Data Visualization** | **Recharts** | Vẽ biểu đồ đường tương tác theo dõi thông số cảm biến thời gian thực |
| **Form & Validation** | **React Hook Form** + **Zod** | Quản lý dữ liệu form và kiểm tra tính hợp lệ dữ liệu |
| **IoT / Hardware** | **Node ESP32-C3 / ESP32** | Thu thập cảm biến và điều khiển relay thiết bị ngoại vi |
| **Cảm biến** | **DHT11**, **BH1750** | Đo nhiệt độ, độ ẩm và cường độ ánh sáng |
| **Giao thức mạng** | **MQTT**, **WebSocket**, **REST API** | Truyền nhận dữ liệu thời gian thực giữa thiết bị và Dashboard |

---

## 5. Cấu Trúc Thư Mục Dự Án

```
home-iot/
├── Phan_Cung/                  # Firmware C/C++ cho vi điều khiển ESP32-C3 (PlatformIO)
│   ├── platformio.ini          # Cấu hình board lolin_c3_mini và thư viện DHT, BH1750, PubSubClient
│   └── src/
│       └── main.cpp            # Mã nguồn điều khiển đọc cảm biến, gửi MQTT và phản hồi ACK
├── backend/                    # Máy chủ Backend Node.js MQTT & MySQL
│   ├── .env.example            # Cấu hình mẫu cổng 5050, Broker MQTT & MySQL
│   ├── package.json            # Thư viện express, mqtt, socket.io, mysql2
│   ├── schema.sql              # Cấu trúc CSDL MySQL 5 bảng (ecoliving_iot)
│   ├── server.js               # Server chính kết nối ESP32 qua MQTT ssdata & dvcontrol
│   └── simulate-esp32.js       # Script mô phỏng ESP32 phục vụ thử nghiệm
├── postman/                    # Bộ tài liệu kiểm thử API Postman
│   ├── PTIT_IoT.postman_collection.json        # Collection đầy đủ 15+ request kiểm thử
│   └── EcoLiving_Local.postman_environment.json # Biến môi trường local
├── html/                       # Bản Web HTML/CSS/JS thuần (Nhấp đúp index.html mở xem ngay)
│   ├── index.html              # Toàn bộ giao diện 4 tab nghiệp vụ
│   ├── style.css               # Định dạng CSS hiện đại, responsive
│   ├── script.js               # Logic điều khiển, lọc tức thì, biểu đồ Chart.js
│   └── avatar.png              # Ảnh đại diện sinh viên
├── public/                     # Tài nguyên tĩnh (Sơ đồ kiến trúc hệ thống, Avatar, Favicon)
│   ├── so_do_kien_truc_iot_he_thong.png
│   ├── ngoc-anh-avatar.png
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── smart-home/         # Các thành phần nghiệp vụ Smart Home
│   │   │   ├── ActionHistoryTab.tsx     # Bảng nhật ký điều khiển & phản hồi phần cứng
│   │   │   ├── AutomationRulesTab.tsx   # Cấu hình luật tự động hóa thiết bị
│   │   │   ├── DashboardTab.tsx         # Bảng điều khiển chính, biểu đồ & thẻ thiết bị
│   │   │   ├── ProfileTab.tsx           # Hồ sơ sinh viên, liên kết & xem báo cáo PDF
│   │   │   ├── SensorsTab.tsx           # Bảng dữ liệu lịch sử đo đạc cảm biến
│   │   │   ├── Sparkline.tsx            # Biểu đồ xu hướng nhỏ gọn
│   │   │   ├── StatusBar.tsx            # Thanh trạng thái kết nối MQTT & Database
│   │   │   ├── ThresholdSettingsTab.tsx # Cài đặt ngưỡng cảnh báo cảm biến
│   │   │   ├── mockData.ts              # Dữ liệu mô phỏng cảm biến, hành động & sinh viên
│   │   │   └── ui.tsx                   # Các UI primitives tùy biến
│   │   └── ui/                 # Thư viện UI Radix + Tailwind tái sử dụng
│   ├── hooks/                  # Custom React Hooks
│   ├── lib/                    # Các module tiện ích, định dạng và xử lý dữ liệu
│   │   ├── api.ts              # Dịch vụ gọi API kết nối Backend Node.js
│   │   ├── smart-home-data.ts  # Định nghĩa Schema & Type dữ liệu IoT
│   │   └── utils.ts
│   ├── routes/                 # File-based routing (TanStack Router)
│   │   ├── __root.tsx          # Root layout của toàn bộ ứng dụng
│   │   └── index.tsx           # Trang điều khiển chính (gồm 4 Tab điều hướng)
│   ├── styles.css              # Cấu hình Tailwind CSS tokens & color variables (oklch)
│   └── server.ts               # Điểm khởi chạy server SSR TanStack Start
├── components.json             # Cấu hình Shadcn/Radix components
├── package.json                # Danh sách thư viện và scripts
├── tsconfig.json               # Cấu hình TypeScript
└── vite.config.ts              # Cấu hình Vite bundler & plugin
```

---

## 6. Hướng Dẫn Cài Đặt & Chạy Thử Ứng Dụng

### Yêu cầu tiên quyết:
- **Node.js**: Phiên bản `>= 18.x` (khuyến nghị `20.x` trở lên)
- **Trình quản lý gói:** `npm`, `yarn`, `pnpm` hoặc `bun`

### Các bước thực hiện:

#### 1. Khởi chạy Backend MQTT Server:
```bash
cd backend
npm start
```
*Server Backend sẽ chạy tại `http://localhost:5050`, tự động kết nối MQTT Broker `broker.hivemq.com` và cơ sở dữ liệu MySQL `ecoliving_iot` (`127.0.0.1:3306`).*

#### 2. Khởi chạy Web Dashboard (Frontend):
Mở một cửa sổ Terminal mới:
```bash
npm run dev
# Hoặc:
bun run dev
```
Mở trình duyệt web và truy cập địa chỉ:
```
http://localhost:8080
```

#### 3. (Tùy chọn) Chạy script giả lập ESP32 khi không có mạch thật:
```bash
cd backend
node simulate-esp32.js
```

---

## 7. Liên Kết Tham Khảo & Minh Chứng

- 🎨 **Figma Prototype UI/UX (Đầy đủ tương tác nút & chuyển trang):** [Trải nghiệm Prototype EcoLiving IoT](https://www.figma.com/proto/hIsVeNHyv5rSlFri1fDhzC/EcoLiving_Iot?node-id=5-638&starting-point-node-id=5%3A638&scaling=contain)
- 🎨 **Figma Design File:** [Thiết kế Giao diện EcoLiving IoT trên Figma](https://www.figma.com/design/hIsVeNHyv5rSlFri1fDhzC/EcoLiving_Iot?node-id=5-638)
- 💻 **Kho mã nguồn GitHub:** [Repository IoT-Ung-dung_B23DCAT015-](https://github.com/ngocahn12345/IoT-Ung-dung_B23DCAT015-)
- 📮 **Tài liệu API Postman:** [PTIT IoT Postman Collection](./postman/PTIT_IoT.postman_collection.json)
- 📄 **Báo cáo BTL hoàn chỉnh:** [Bao_Cao_BTL_IoT_B23DCAT015_NguyenThiNgocAnh.docx](./Bao_Cao_BTL_IoT_B23DCAT015_NguyenThiNgocAnh.docx)

---

*Học viện Công nghệ Bưu chính Viễn thông — Khoa An toàn thông tin — 2026.*
