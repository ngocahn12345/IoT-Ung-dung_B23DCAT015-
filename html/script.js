/**
 * ECOLIVING SMART HOME IOT — JAVASCRIPT LOGIC
 * Tác giả: Nguyễn Thị Ngọc Anh - B23DCAT015
 * Các tính năng: Chuyển Tab, Điều khiển thiết bị, Vẽ biểu đồ Chart.js, Lọc tức thì & Phân trang
 */

// ================= DỮ LIỆU CẢM BIẾN & LỊCH SỬ ĐO ĐẠC =================
const sensorRecords = [
  { id: "#DS-001", sensorName: "DHT11 (Nhiệt độ)", sensorType: "TEMPERATURE", room: "Phòng 1 (Phòng Khách)", value: 20.5, unit: "°C", timestamp: "2026-08-27 09:15:30", status: "NORMAL", topic: "ssdata" },
  { id: "#DS-002", sensorName: "DHT11 (Độ ẩm)", sensorType: "HUMIDITY", room: "Phòng 1 (Phòng Khách)", value: 80.0, unit: "%", timestamp: "2026-08-27 09:15:30", status: "WARNING", topic: "ssdata" },
  { id: "#DS-003", sensorName: "BH1750 (Ánh sáng)", sensorType: "LIGHT", room: "Phòng 1 (Phòng Khách)", value: 1000, unit: "Lux", timestamp: "2026-08-27 09:15:30", status: "NORMAL", topic: "ssdata" },
  { id: "#DS-004", sensorName: "DHT11 (Nhiệt độ)", sensorType: "TEMPERATURE", room: "Phòng 2 (Phòng Ngủ)", value: 29.2, unit: "°C", timestamp: "2026-08-26 18:40:15", status: "WARNING", topic: "ssdata" },
  { id: "#DS-005", sensorName: "BH1750 (Ánh sáng)", sensorType: "LIGHT", room: "Ban công", value: 1250, unit: "Lux", timestamp: "2026-08-26 12:05:00", status: "NORMAL", topic: "ssdata" },
  { id: "#DS-006", sensorName: "DHT11 (Nhiệt độ)", sensorType: "TEMPERATURE", room: "Phòng 1 (Phòng Khách)", value: 33.4, unit: "°C", timestamp: "2026-08-25 15:45:22", status: "CRITICAL", topic: "ssdata" },
  { id: "#DS-007", sensorName: "DHT11 (Độ ẩm)", sensorType: "HUMIDITY", room: "Phòng 1 (Phòng Khách)", value: 86.0, unit: "%", timestamp: "2026-08-25 15:45:22", status: "CRITICAL", topic: "ssdata" },
  { id: "#DS-008", sensorName: "BH1750 (Ánh sáng)", sensorType: "LIGHT", room: "Phòng 1 (Phòng Khách)", value: 890, unit: "Lux", timestamp: "2026-08-25 15:45:22", status: "NORMAL", topic: "ssdata" },
  { id: "#DS-009", sensorName: "DHT11 (Nhiệt độ)", sensorType: "TEMPERATURE", room: "Phòng 2 (Phòng Ngủ)", value: 24.5, unit: "°C", timestamp: "2026-08-24 14:30:15", status: "NORMAL", topic: "ssdata" },
  { id: "#DS-010", sensorName: "DHT11 (Độ ẩm)", sensorType: "HUMIDITY", room: "Phòng 2 (Phòng Ngủ)", value: 65.0, unit: "%", timestamp: "2026-08-24 14:30:15", status: "NORMAL", topic: "ssdata" },
  { id: "#DS-011", sensorName: "BH1750 (Ánh sáng)", sensorType: "LIGHT", room: "Phòng 1 (Phòng Khách)", value: 180, unit: "Lux", timestamp: "2026-08-20 18:15:00", status: "WARNING", topic: "ssdata" },
  { id: "#DS-012", sensorName: "DHT11 (Nhiệt độ)", sensorType: "TEMPERATURE", room: "Phòng 1 (Phòng Khách)", value: 27.8, unit: "°C", timestamp: "2026-08-15 10:00:00", status: "NORMAL", topic: "ssdata" }
];

// ================= DỮ LIỆU NHẬT KÝ HÀNH ĐỘNG (ACTION LOGS) =================
const actionRecords = [
  { id: "#ACT-101", deviceName: "Quạt", deviceType: "FAN", action: "ON", status: "ON", sentTime: "2026-08-27 09:15:30", responseTime: "2026-08-27 09:15:31 (1.0s)", performedBy: "Hệ thống tự động (Độ ẩm > 75%)", detail: "Kích hoạt quạt thông gió tự động" },
  { id: "#ACT-102", deviceName: "Đèn", deviceType: "LIGHT", action: "OFF", status: "OFF", sentTime: "2026-08-26 21:10:00", responseTime: "2026-08-26 21:10:01 (0.8s)", performedBy: "Người dùng (Ngọc Anh)", detail: "Tắt đèn phòng khách từ Web Dashboard" },
  { id: "#ACT-103", deviceName: "Điều hòa", deviceType: "AC", action: "ON", status: "ON", sentTime: "2026-08-25 15:45:22", responseTime: "2026-08-25 15:45:24 (1.5s)", performedBy: "Hệ thống tự động (Nhiệt độ > 28°C)", detail: "Bật điều hòa làm mát nhiệt độ phòng 33.4°C" },
  { id: "#ACT-104", deviceName: "Quạt", deviceType: "FAN", action: "OFF", status: "OFF", sentTime: "2026-08-24 14:30:15", responseTime: "2026-08-24 14:30:16 (0.9s)", performedBy: "Người dùng (Ngọc Anh)", detail: "Tắt quạt thủ công" },
  { id: "#ACT-105", deviceName: "Đèn", deviceType: "LIGHT", action: "ON", status: "ON", sentTime: "2026-08-20 18:15:00", responseTime: "2026-08-20 18:15:01 (0.7s)", performedBy: "Hệ thống tự động (Ánh sáng < 200 Lux)", detail: "Tự động bật đèn khi trời tối" },
  { id: "#ACT-106", deviceName: "Điều hòa", deviceType: "AC", action: "OFF", status: "OFF", sentTime: "2026-08-15 10:00:00", responseTime: "2026-08-15 10:00:02 (1.2s)", performedBy: "Người dùng (Ngọc Anh)", detail: "Tắt điều hòa phòng khách" },
  { id: "#ACT-107", deviceName: "Quạt", deviceType: "FAN", action: "ON", status: "LOADING", sentTime: "2026-08-10 08:00:00", responseTime: "Đang chờ phản hồi...", performedBy: "Hệ thống tự động", detail: "Đang chờ vi điều khiển phản hồi lệnh bật quạt" },
  { id: "#ACT-108", deviceName: "Đèn", deviceType: "LIGHT", action: "OFF", status: "OFF", sentTime: "2026-08-01 23:00:00", responseTime: "2026-08-01 23:00:01 (0.5s)", performedBy: "Người dùng (Ngọc Anh)", detail: "Tắt toàn bộ đèn trước khi ngủ" },
  { id: "#ACT-109", deviceName: "Quạt", deviceType: "FAN", action: "ON", status: "ON", sentTime: "2026-07-28 16:30:00", responseTime: "2026-07-28 16:30:01 (1.1s)", performedBy: "Người dùng (Ngọc Anh)", detail: "Bật quạt phòng ngủ" },
  { id: "#ACT-110", deviceName: "Đèn", deviceType: "LIGHT", action: "ON", status: "ON", sentTime: "2026-07-27 19:00:00", responseTime: "2026-07-27 19:00:01 (0.8s)", performedBy: "Người dùng (Ngọc Anh)", detail: "Bật đèn chiếu sáng buổi tối" }
];

// ================= DỮ LIỆU BIỂU ĐỒ =================
const chartLabels = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const chartTempData = [20.2, 21.0, 22.4, 24.1, 26.5, 27.8, 28.5, 26.2, 23.8];
const chartHumData = [78, 76, 74, 71, 68, 65, 69, 75, 80];
const chartLuxData = [450, 620, 850, 980, 1120, 1050, 1000, 920, 740];

let mainChartInstance = null;

// ================= 1. KHỞI TẠO HỆ THỐNG KHI LOAD TRANG =================
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  initChart();
  renderSensorsTable();
  setupActionHistoryFilters(); // Lọc tức thì cho Nhật ký hành động
  renderActionHistoryTable();
  setupDeviceToggles();
  setupMobileMenu();
});

// ================= 2. ĐIỀU HƯỚNG TABS =================
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const headerTitle = document.getElementById("headerTitle");

  const tabTitles = {
    tabDashboard: "Bảng điều khiển",
    tabSensors: "Dữ liệu cảm biến",
    tabLogs: "Nhật ký hành động",
    tabProfile: "Hồ sơ cá nhân"
  };

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");

      navItems.forEach((i) => i.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");

      if (headerTitle && tabTitles[targetId]) {
        headerTitle.textContent = tabTitles[targetId];
      }

      // Đóng sidebar trên mobile nếu đang mở
      document.getElementById("sidebar").classList.remove("open");
    });
  });
}

function setupMobileMenu() {
  const menuBtn = document.getElementById("mobileMenuBtn");
  const sidebar = document.getElementById("sidebar");
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
}

// ================= 3. ĐIỀU KHIỂN THIẾT BỊ (TAB 1) =================
function setupDeviceToggles() {
  const devices = [
    { toggleId: "toggleFan", cardId: "cardFan", statusId: "statusFan", name: "Quạt" },
    { toggleId: "toggleLight", cardId: "cardLight", statusId: "statusLight", name: "Đèn" },
    { toggleId: "toggleAc", cardId: "cardAc", statusId: "statusAc", name: "Điều hòa" }
  ];

  devices.forEach((d) => {
    const toggle = document.getElementById(d.toggleId);
    const card = document.getElementById(d.cardId);
    const status = document.getElementById(d.statusId);

    if (toggle) {
      toggle.addEventListener("change", (e) => {
        const isOn = e.target.checked;
        if (isOn) {
          card.classList.add("on");
          status.textContent = "BẬT";
          status.style.color = "var(--success)";
        } else {
          card.classList.remove("on");
          status.textContent = "TẮT";
          status.style.color = "var(--text-muted)";
        }

        // Tùy chọn: Gửi lệnh tới Backend nếu đang bật server http://localhost:5050
        try {
          fetch("http://localhost:5050/api/control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device: d.name.toLowerCase(), action: isOn })
          }).catch(() => {});
        } catch (_) {}
      });
    }
  });

  // Nút chuyển chế độ Auto / Manual
  document.querySelectorAll(".mode-pills").forEach((pillGroup) => {
    const btns = pillGroup.querySelectorAll(".pill-btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        btns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  });
}

// ================= 4. VẼ BIỂU ĐỒ CHART.JS (TAB 1) =================
function initChart() {
  const ctx = document.getElementById("sensorChart");
  if (!ctx) return;

  mainChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: "Nhiệt độ (°C)",
          data: chartTempData,
          borderColor: "#f43f5e",
          backgroundColor: "rgba(244, 63, 94, 0.1)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: false,
          yAxisID: "y"
        },
        {
          label: "Độ ẩm (%)",
          data: chartHumData,
          borderColor: "#0284c7",
          backgroundColor: "rgba(2, 132, 199, 0.1)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: false,
          yAxisID: "y"
        },
        {
          label: "Ánh sáng (Lux)",
          data: chartLuxData,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          borderWidth: 2,
          tension: 0.35,
          fill: false,
          yAxisID: "yLux"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: "bold" },
          bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Nhiệt độ (°C) / Độ ẩm (%)" },
          grid: { color: "#f1f5f9" }
        },
        yLux: {
          type: "linear",
          position: "right",
          title: { display: true, text: "Ánh sáng (Lux)" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// ================= 5. BẢNG DỮ LIỆU CẢM BIẾN (TAB 2) =================
let sensorPage = 1;
let sensorPageSize = 10;
let sensorFilterType = "ALL";
let sensorSearchTerm = "";

function renderSensorsTable() {
  const tbody = document.getElementById("sensorTableBody");
  if (!tbody) return;

  const filtered = sensorRecords.filter((r) => {
    if (sensorFilterType === "TIME") {
      if (sensorSearchTerm) {
        const term = sensorSearchTerm.toLowerCase();
        const formattedTime = r.timestamp ? r.timestamp.replace(/-/g, "/") : "";
        let vnDate = "";
        if (r.timestamp && r.timestamp.includes("-")) {
          const parts = r.timestamp.split(" ")[0].split("-");
          if (parts.length === 3) vnDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return (
          r.timestamp.toLowerCase().includes(term) ||
          formattedTime.toLowerCase().includes(term) ||
          (vnDate && vnDate.includes(term))
        );
      }
      return true;
    }
    if (sensorFilterType !== "ALL" && r.sensorType !== sensorFilterType) return false;
    if (sensorSearchTerm) {
      const term = sensorSearchTerm.toLowerCase();
      const valStr = r.value !== undefined ? r.value.toString() : "";
      const valWithUnit = (r.value + (r.unit || "")).toLowerCase();
      const formattedTime = r.timestamp ? r.timestamp.replace(/-/g, "/") : "";

      // Hỗ trợ ngày tháng dạng DD/MM/YYYY
      let vnDate = "";
      if (r.timestamp && r.timestamp.includes("-")) {
        const parts = r.timestamp.split(" ")[0].split("-");
        if (parts.length === 3) vnDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      return (
        r.id.toLowerCase().includes(term) ||
        r.sensorName.toLowerCase().includes(term) ||
        r.room.toLowerCase().includes(term) ||
        valStr.includes(term) ||
        valWithUnit.includes(term) ||
        r.timestamp.includes(term) ||
        formattedTime.includes(term) ||
        (vnDate && vnDate.includes(term))
      );
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / sensorPageSize) || 1;
  const start = (sensorPage - 1) * sensorPageSize;
  const paged = filtered.slice(start, start + sensorPageSize);

  tbody.innerHTML = "";
  if (paged.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">Không tìm thấy dữ liệu đo phù hợp</td></tr>`;
  } else {
    paged.forEach((r, idx) => {
      let badgeClass = "badge-normal";
      let statusText = "Bình thường";
      if (r.status === "WARNING") { badgeClass = "badge-warning"; statusText = "Cảnh báo"; }
      if (r.status === "CRITICAL") { badgeClass = "badge-critical"; statusText = "Nguy hiểm"; }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="table-id">${r.id}</td>
        <td><strong>${r.sensorName}</strong></td>
        <td>${r.room}</td>
        <td><strong>${r.value}</strong> ${r.unit}</td>
        <td>${r.timestamp}</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td><code style="background: var(--bg-subtle); padding: 2px 6px; border-radius: 4px;">${r.topic}</code></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Cập nhật phân trang
  const infoEl = document.getElementById("sensorPaginationInfo");
  if (infoEl) infoEl.textContent = `Hiển thị ${Math.min(start + 1, total)} - ${Math.min(start + sensorPageSize, total)} / ${total} bản ghi`;

  renderPaginationControls("sensorPaginationControls", sensorPage, totalPages, (p) => {
    sensorPage = p;
    renderSensorsTable();
  });
}

document.getElementById("sensorSearchInput")?.addEventListener("input", (e) => {
  sensorSearchTerm = e.target.value.trim();
  sensorPage = 1;
  renderSensorsTable();
});

document.getElementById("sensorTypeFilter")?.addEventListener("change", (e) => {
  sensorFilterType = e.target.value;
  sensorPage = 1;
  renderSensorsTable();
});

document.getElementById("sensorPageSize")?.addEventListener("change", (e) => {
  sensorPageSize = Number(e.target.value);
  sensorPage = 1;
  renderSensorsTable();
});

// ================= 6. BẢNG NHẬT KÝ HÀNH ĐỘNG — LỌC TỨC THÌ (TAB 3) =================
let actionPage = 1;
let actionPageSize = 10;
let actionDeviceFilter = "ALL";
let actionTypeFilter = "ALL";
let actionStatusFilter = "ALL";
let actionSearchTerm = "";

function setupActionHistoryFilters() {
  const searchInput = document.getElementById("actionSearchInput");
  const deviceSelect = document.getElementById("actionDeviceFilter");
  const actionSelect = document.getElementById("actionTypeFilter");
  const statusSelect = document.getElementById("actionStatusFilter");
  const resetBtn = document.getElementById("actionResetBtn");

  // 👉 LỌC NGAY LẬP TỨC KHI CHỌN THIẾT BỊ
  deviceSelect?.addEventListener("change", (e) => {
    actionDeviceFilter = e.target.value;
    actionPage = 1;
    renderActionHistoryTable(); // Lọc luôn bên dưới!
  });

  // 👉 LỌC NGAY LẬP TỨC KHI CHỌN HÀNH ĐỘNG
  actionSelect?.addEventListener("change", (e) => {
    actionTypeFilter = e.target.value;
    actionPage = 1;
    renderActionHistoryTable(); // Lọc luôn bên dưới!
  });

  // 👉 LỌC NGAY LẬP TỨC KHI CHỌN TRẠNG THÁI
  statusSelect?.addEventListener("change", (e) => {
    actionStatusFilter = e.target.value;
    actionPage = 1;
    renderActionHistoryTable(); // Lọc luôn bên dưới!
  });

  // 👉 LỌC NGAY LẬP TỨC KHI GÕ TÌM KIẾM
  searchInput?.addEventListener("input", (e) => {
    actionSearchTerm = e.target.value.trim();
    actionPage = 1;
    renderActionHistoryTable();
  });

  // Nút đặt lại
  resetBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (deviceSelect) deviceSelect.value = "ALL";
    if (actionSelect) actionSelect.value = "ALL";
    if (statusSelect) statusSelect.value = "ALL";

    actionSearchTerm = "";
    actionDeviceFilter = "ALL";
    actionTypeFilter = "ALL";
    actionStatusFilter = "ALL";
    actionPage = 1;
    renderActionHistoryTable();
  });

  document.getElementById("actionPageSize")?.addEventListener("change", (e) => {
    actionPageSize = Number(e.target.value);
    actionPage = 1;
    renderActionHistoryTable();
  });
}

function renderActionHistoryTable() {
  const tbody = document.getElementById("actionTableBody");
  if (!tbody) return;

  const filtered = actionRecords.filter((r) => {
    // 1. Lọc Thiết bị
    if (actionDeviceFilter !== "ALL" && r.deviceType !== actionDeviceFilter) return false;
    // 2. Lọc Hành động
    if (actionTypeFilter !== "ALL" && r.action !== actionTypeFilter) return false;
    // 3. Lọc Trạng thái
    if (actionStatusFilter !== "ALL" && r.status !== actionStatusFilter) return false;
    // 4. Tìm kiếm từ khóa
    if (actionSearchTerm) {
      const term = actionSearchTerm.toLowerCase();
      return (
        r.id.toLowerCase().includes(term) ||
        r.deviceName.toLowerCase().includes(term) ||
        r.detail.toLowerCase().includes(term) ||
        r.sentTime.includes(term)
      );
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / actionPageSize) || 1;
  const start = (actionPage - 1) * actionPageSize;
  const paged = filtered.slice(start, start + actionPageSize);

  tbody.innerHTML = "";
  if (paged.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">Không tìm thấy nhật ký hành động phù hợp</td></tr>`;
  } else {
    paged.forEach((r) => {
      let actionBadge = r.action === "ON" 
        ? `<span class="badge" style="background: var(--success-bg); color: var(--success); font-weight: bold;">BẬT</span>` 
        : `<span class="badge" style="background: var(--bg-subtle); color: var(--text-muted); font-weight: bold;">TẮT</span>`;

      let statusBadge = r.status === "ON"
        ? `<span class="badge badge-normal">● BẬT</span>`
        : r.status === "OFF"
        ? `<span class="badge" style="background: var(--bg-subtle); color: var(--text-muted);">● TẮT</span>`
        : `<span class="badge badge-warning">↻ Đang xử lý</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="table-id">${r.id}</td>
        <td><strong>${r.deviceName}</strong></td>
        <td>${actionBadge}</td>
        <td>${statusBadge}</td>
        <td>${r.sentTime}</td>
        <td><strong>${r.responseTime}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Cập nhật phân trang
  const infoEl = document.getElementById("actionPaginationInfo");
  if (infoEl) infoEl.textContent = `Hiển thị ${Math.min(start + 1, total)} - ${Math.min(start + actionPageSize, total)} / ${total} bản ghi`;

  renderPaginationControls("actionPaginationControls", actionPage, totalPages, (p) => {
    actionPage = p;
    renderActionHistoryTable();
  });
}

// Hàm vẽ nút chuyển trang
function renderPaginationControls(containerId, currentPage, totalPages, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.className = "page-btn";
  prevBtn.textContent = "‹";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => onPageChange(currentPage - 1);
  container.appendChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    const pBtn = document.createElement("button");
    pBtn.className = `page-btn ${i === currentPage ? "active" : ""}`;
    pBtn.textContent = i;
    pBtn.onclick = () => onPageChange(i);
    container.appendChild(pBtn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = "page-btn";
  nextBtn.textContent = "›";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => onPageChange(currentPage + 1);
  container.appendChild(nextBtn);
}
