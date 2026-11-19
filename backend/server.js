const express = require('express');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const PORT = Number(process.env.PORT || 5050);
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
const TOPIC_SENSOR = process.env.TOPIC_SENSOR || 'ssdata';
const TOPIC_CONTROL = process.env.TOPIC_CONTROL || 'dvcontrol';
const TOPIC_RESPOND = process.env.TOPIC_RESPOND || 'dvrespond';

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';
const DB_NAME = process.env.DB_NAME || 'ecoliving_iot';
const DB_SOCKET = process.env.DB_SOCKET || '';
const API_KEY_SECRET = process.env.API_KEY_SECRET || 'ecoliving-b23dcat015-mysql-secret-2026';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] },
});

// ==========================================
// 1. TIỆN ÍCH ĐỊNH DẠNG, BẢO MẬT & ÁNH XẠ
// ==========================================
function formatLocalTimestamp(date = new Date(), withMs = false) {
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const base =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return withMs ? `${base}.${pad(date.getMilliseconds(), 3)}` : base;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = String(storedHash).split(':');
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(String(password), salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

const revokedApiKeys = new Set();

function signApiKey(user) {
  const payload = {
    uid: user.user_id,
    u: user.username,
    iat: Date.now(),
    jti: crypto.randomBytes(8).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', API_KEY_SECRET).update(encoded).digest('base64url');
  return `eco_${encoded}.${sig}`;
}

function decodeSignedApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('eco_')) return null;
  if (revokedApiKeys.has(apiKey)) return null;
  const raw = apiKey.slice(4);
  const dotIdx = raw.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = raw.slice(0, dotIdx);
  const providedSig = raw.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac('sha256', API_KEY_SECRET).update(encoded).digest('base64url');
  const bufA = Buffer.from(providedSig, 'utf8');
  const bufB = Buffer.from(expectedSig, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || !payload.uid || !payload.iat) return null;
    return payload;
  } catch {
    return null;
  }
}

const DEVICE_SPECS = {
  led1: { dbId: 1, key: 'led1', name: 'Điều hòa (LED 1)', type: 'AC', uiId: 'ac_1', gpio: 'GPIO 5' },
  led2: { dbId: 2, key: 'led2', name: 'Quạt thông gió (LED 2)', type: 'FAN', uiId: 'fan_1', gpio: 'GPIO 6' },
  led3: { dbId: 3, key: 'led3', name: 'Đèn chiếu sáng (LED 3)', type: 'LIGHT', uiId: 'led_1', gpio: 'GPIO 7' },
};

const DEVICE_KEY_BY_DB_ID = { 1: 'led1', 2: 'led2', 3: 'led3' };

const DEVICE_ALIASES = {
  '1': 'led1',
  led1: 'led1',
  ac_1: 'led1',
  ac: 'led1',
  dieuhoa: 'led1',
  dieu_hoa: 'led1',
  '2': 'led2',
  led2: 'led2',
  fan_1: 'led2',
  fan: 'led2',
  quat: 'led2',
  '3': 'led3',
  led3: 'led3',
  led_1: 'led3',
  den: 'led3',
  light: 'led3',
};

function resolveDevice(rawDevice) {
  if (rawDevice === undefined || rawDevice === null) return null;
  const normalized = String(rawDevice).trim().toLowerCase();
  const key = DEVICE_ALIASES[normalized];
  return key ? DEVICE_SPECS[key] : null;
}

function parseActionFlag(rawAction) {
  if (typeof rawAction === 'boolean') return rawAction;
  if (typeof rawAction === 'number') return rawAction !== 0;
  const normalized = String(rawAction ?? '').trim().toUpperCase();
  if (['ON', 'TRUE', '1', 'BAT', 'BẬT'].includes(normalized)) return true;
  if (['OFF', 'FALSE', '0', 'TAT', 'TẮT'].includes(normalized)) return false;
  return null;
}

const SENSOR_IDS = {
  TEMPERATURE: 1,
  HUMIDITY: 2,
  LIGHT: 3,
};

// ==========================================
// 2. KẾT NỐI & KHỞI TẠO CƠ SỞ DỮ LIỆU MYSQL
// ==========================================
let pool = null;

const systemStatus = {
  databaseConnected: false,
  lastDbError: null,
  mqttConnected: false,
  lastMqttError: null,
  clientConnectedCount: 0,
};

let latestSensors = {
  temperature: null,
  humidity: null,
  light: null,
  tempStatus: 'NORMAL',
  humStatus: 'NORMAL',
  luxStatus: 'NORMAL',
  timestamp: null,
  hasData: false,
};

const latestDevices = {
  led1: { key: 'led1', uiId: 'ac_1', name: 'Điều hòa (LED 1)', type: 'AC', state: 'OFF', auto: true, lastUpdated: null },
  led2: { key: 'led2', uiId: 'fan_1', name: 'Quạt thông gió (LED 2)', type: 'FAN', state: 'OFF', auto: true, lastUpdated: null },
  led3: { key: 'led3', uiId: 'led_1', name: 'Đèn chiếu sáng (LED 3)', type: 'LIGHT', state: 'OFF', auto: true, lastUpdated: null },
};

let hasInitialDeviceSnapshot = false;
const pendingCommands = new Map();

function buildMysqlConfig(withDatabase = true) {
  const base = {
    user: DB_USER,
    password: DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    charset: 'utf8mb4',
  };
  if (withDatabase) base.database = DB_NAME;
  if (DB_SOCKET && fs.existsSync(DB_SOCKET) && (DB_HOST === '127.0.0.1' || DB_HOST === 'localhost')) {
    return { ...base, host: DB_HOST, port: DB_PORT };
  }
  return { ...base, host: DB_HOST, port: DB_PORT };
}

async function openBootstrapConnection() {
  try {
    return await mysql.createConnection(buildMysqlConfig(false));
  } catch (tcpErr) {
    if (DB_SOCKET && fs.existsSync(DB_SOCKET)) {
      return await mysql.createConnection({
        socketPath: DB_SOCKET,
        user: DB_USER,
        password: DB_PASSWORD,
        dateStrings: true,
        charset: 'utf8mb4',
      });
    }
    throw tcpErr;
  }
}

async function initDatabase() {
  const conn = await openBootstrapConnection();
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }

  let poolCfg = buildMysqlConfig(true);
  pool = mysql.createPool(poolCfg);
  try {
    await pool.query('SELECT 1');
  } catch (tcpErr) {
    if (DB_SOCKET && fs.existsSync(DB_SOCKET)) {
      await pool.end().catch(() => {});
      poolCfg = {
        socketPath: DB_SOCKET,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        dateStrings: true,
        charset: 'utf8mb4',
      };
      pool = mysql.createPool(poolCfg);
      await pool.query('SELECT 1');
    } else {
      throw tcpErr;
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`User\` (
      \`user_id\` INT(10) NOT NULL AUTO_INCREMENT,
      \`username\` VARCHAR(50) NOT NULL,
      \`password\` VARCHAR(255) NOT NULL,
      \`fullname\` VARCHAR(150) NOT NULL,
      \`created_at\` DATE NOT NULL,
      \`email\` VARCHAR(100) NOT NULL,
      \`student_id\` VARCHAR(50) NOT NULL,
      \`dob\` DATE NOT NULL,
      \`gender\` VARCHAR(10) NOT NULL,
      \`phone\` VARCHAR(15) NOT NULL,
      \`address\` VARCHAR(255) NOT NULL,
      \`school\` VARCHAR(150) NOT NULL,
      \`major\` VARCHAR(100) NOT NULL,
      \`cohort\` VARCHAR(50) NOT NULL,
      \`github_link\` VARCHAR(255) NULL DEFAULT NULL,
      \`figma_link\` VARCHAR(255) NULL DEFAULT NULL,
      \`avatar\` VARCHAR(255) NULL DEFAULT NULL,
      \`updated_at\` TIMESTAMP NULL DEFAULT NULL,
      \`postman_url\` VARCHAR(255) NULL DEFAULT NULL,
      PRIMARY KEY (\`user_id\`),
      UNIQUE KEY \`uq_user_username\` (\`username\`),
      UNIQUE KEY \`uq_user_email\` (\`email\`),
      UNIQUE KEY \`uq_user_student_id\` (\`student_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Devices\` (
      \`device_id\` INT(10) NOT NULL AUTO_INCREMENT,
      \`device_name\` VARCHAR(100) NOT NULL,
      \`status\` VARCHAR(10) NOT NULL DEFAULT 'OFF',
      \`mode\` VARCHAR(10) NOT NULL DEFAULT 'Auto',
      \`device_type\` VARCHAR(50) NOT NULL,
      \`description\` VARCHAR(255) NULL DEFAULT NULL,
      \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`device_id\`),
      UNIQUE KEY \`uq_devices_name\` (\`device_name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Sensors\` (
      \`sensor_id\` INT(10) NOT NULL AUTO_INCREMENT,
      \`sensor_name\` VARCHAR(50) NOT NULL,
      \`location\` VARCHAR(100) NOT NULL,
      \`type\` VARCHAR(255) NOT NULL,
      \`status\` VARCHAR(100) NOT NULL DEFAULT 'NORMAL',
      \`unit\` VARCHAR(20) NOT NULL,
      \`description\` VARCHAR(255) NULL DEFAULT NULL,
      \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`sensor_id\`),
      UNIQUE KEY \`uq_sensors_name\` (\`sensor_name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`DataSensor\` (
      \`data_id\` BIGINT(20) NOT NULL AUTO_INCREMENT,
      \`value\` DOUBLE NOT NULL,
      \`timestamp\` DATETIME NOT NULL,
      \`sensor_id\` INT(10) NOT NULL,
      \`alert_status\` VARCHAR(50) NOT NULL,
      PRIMARY KEY (\`data_id\`),
      KEY \`idx_datasensor_sensor_ts\` (\`sensor_id\`, \`timestamp\`),
      KEY \`idx_datasensor_ts\` (\`timestamp\`),
      CONSTRAINT \`fk_datasensor_sensor\`
        FOREIGN KEY (\`sensor_id\`) REFERENCES \`Sensors\` (\`sensor_id\`)
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Action_history\` (
      \`action_id\` BIGINT(20) NOT NULL AUTO_INCREMENT,
      \`action_type\` VARCHAR(10) NOT NULL,
      \`status\` VARCHAR(255) NOT NULL,
      \`user_id\` INT(10) NULL DEFAULT NULL,
      \`device_id\` INT(10) NOT NULL,
      \`created_at\` DATETIME(3) NOT NULL,
      \`activation_time\` DATETIME(3) NOT NULL,
      \`response_time\` DATETIME(3) NULL DEFAULT NULL,
      PRIMARY KEY (\`action_id\`),
      KEY \`idx_action_device\` (\`device_id\`),
      KEY \`idx_action_user\` (\`user_id\`),
      CONSTRAINT \`fk_action_user\`
        FOREIGN KEY (\`user_id\`) REFERENCES \`User\` (\`user_id\`)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`fk_action_device\`
        FOREIGN KEY (\`device_id\`) REFERENCES \`Devices\` (\`device_id\`)
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Khởi tạo dữ liệu nền (User, Devices, Sensors) nếu chưa có
  const [userRows] = await pool.query('SELECT COUNT(*) AS count FROM `User`');
  if (userRows[0].count === 0) {
    const adminPass = process.env.DEFAULT_ADMIN_PASSWORD || '123456';
    await pool.query(
      `INSERT INTO \`User\`
        (user_id, username, password, fullname, created_at, email, student_id, dob, gender, phone, address, school, major, cohort, github_link, figma_link, avatar, updated_at, postman_url)
       VALUES
        (1, 'admin', ?, 'Nguyễn Thị Ngọc Anh', '2026-11-12', 'linhchichibi21112014@gmail.com', 'B23DCAT015', '2005-08-01', 'Nữ', '0978701633', 'Hà Đông, Hà Nội, Việt Nam', 'Học viện Công nghệ Bưu chính Viễn thông (PTIT)', 'An toàn thông tin', '2023 - 2028', 'https://github.com/ngocahn12345/IoT-Ung-dung_B23DCAT015-', 'https://www.figma.com/design/Ba7cC3hhH3Tya1SygJslsM/EcoLiving_Iot_B23DCAT015?node-id=0-1&t=eZsKdaWncHiblLfT-1', '/ngoc-anh-avatar.png', NULL, 'https://documenter.getpostman.com/view/60122617/2sBYHbsw9Z#intro')`,
      [hashPassword(adminPass)]
    );
  } else {
    // Cập nhật lại các liên kết mới nhất cho tài khoản admin
    await pool.query(
      `UPDATE \`User\` SET 
        github_link = 'https://github.com/ngocahn12345/IoT-Ung-dung_B23DCAT015-',
        figma_link = 'https://www.figma.com/design/Ba7cC3hhH3Tya1SygJslsM/EcoLiving_Iot_B23DCAT015?node-id=0-1&t=eZsKdaWncHiblLfT-1',
        postman_url = 'https://documenter.getpostman.com/view/60122617/2sBYHbsw9Z#intro'
       WHERE user_id = 1`
    );
  }

  await pool.query(`
    INSERT IGNORE INTO \`Devices\` (device_id, device_name, status, mode, device_type, description)
    VALUES
      (1, 'Điều hòa (LED 1)', 'OFF', 'Auto', 'AC', 'Đầu ra led1 trên GPIO 5 (ESP32-C3)'),
      (2, 'Quạt thông gió (LED 2)', 'OFF', 'Auto', 'FAN', 'Đầu ra led2 trên GPIO 6 (ESP32-C3)'),
      (3, 'Đèn chiếu sáng (LED 3)', 'OFF', 'Auto', 'LIGHT', 'Đầu ra led3 trên GPIO 7 (ESP32-C3)')
  `);

  await pool.query(`
    INSERT IGNORE INTO \`Sensors\` (sensor_id, sensor_name, location, type, status, unit, description)
    VALUES
      (1, 'DHT11 (Nhiệt độ)', 'Phòng 1 (Phòng Khách)', 'TEMPERATURE', 'NORMAL', '°C', 'Cảm biến nhiệt độ DHT11 nối chân GPIO 1'),
      (2, 'DHT11 (Độ ẩm)', 'Phòng 1 (Phòng Khách)', 'HUMIDITY', 'NORMAL', '%', 'Cảm biến độ ẩm DHT11 nối chân GPIO 1'),
      (3, 'BH1750 (Ánh sáng)', 'Phòng 1 (Phòng Khách)', 'LIGHT', 'NORMAL', 'Lux', 'Cảm biến cường độ ánh sáng BH1750 I2C (SDA GPIO 8, SCL GPIO 9)')
  `);

  systemStatus.databaseConnected = true;
  systemStatus.lastDbError = null;
  console.log(`📦 Đã kết nối cơ sở dữ liệu MySQL: ${DB_NAME} (${DB_HOST}:${DB_PORT})`);

  await Promise.all([loadLatestSensorsFromDb(), loadLatestDevicesFromDb()]);
}

async function loadLatestSensorsFromDb() {
  if (!pool) return latestSensors;
  const [rows] = await pool.query(`
    SELECT
      s.type AS sensor_type,
      ds.value AS value,
      ds.alert_status AS status,
      DATE_FORMAT(ds.timestamp, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM DataSensor ds
    INNER JOIN Sensors s ON ds.sensor_id = s.sensor_id
    INNER JOIN (
      SELECT sensor_id, MAX(data_id) AS max_id
      FROM DataSensor
      GROUP BY sensor_id
    ) latest ON ds.data_id = latest.max_id
  `);

  if (!rows.length) {
    latestSensors = {
      temperature: null,
      humidity: null,
      light: null,
      tempStatus: 'NORMAL',
      humStatus: 'NORMAL',
      luxStatus: 'NORMAL',
      timestamp: null,
      hasData: false,
    };
    return latestSensors;
  }

  const byType = Object.fromEntries(rows.map((r) => [r.sensor_type, r]));
  const tempRow = byType.TEMPERATURE;
  const humRow = byType.HUMIDITY;
  const lightRow = byType.LIGHT;

  latestSensors = {
    temperature: tempRow ? Number(tempRow.value) : null,
    humidity: humRow ? Number(humRow.value) : null,
    light: lightRow ? Number(lightRow.value) : null,
    tempStatus: tempRow ? tempRow.status : 'NORMAL',
    humStatus: humRow ? humRow.status : 'NORMAL',
    luxStatus: lightRow ? lightRow.status : 'NORMAL',
    timestamp: (tempRow || humRow || lightRow).created_at,
    hasData: true,
  };
  return latestSensors;
}

async function loadLatestDevicesFromDb() {
  if (!pool) return latestDevices;
  const [rows] = await pool.query(
    `SELECT device_id, status, mode, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM Devices WHERE device_id IN (1, 2, 3)`
  );
  for (const row of rows) {
    const key = DEVICE_KEY_BY_DB_ID[row.device_id];
    if (key && latestDevices[key]) {
      latestDevices[key].state = row.status === 'ON' ? 'ON' : 'OFF';
      latestDevices[key].auto = String(row.mode || 'Auto').toLowerCase() === 'auto';
      latestDevices[key].lastUpdated = row.updated_at || null;
    }
  }
  return latestDevices;
}

function evaluateAlerts(sensors) {
  const alerts = [];
  if (!sensors || !sensors.hasData) return alerts;
  if (typeof sensors.temperature === 'number' && sensors.temperature > 35) {
    alerts.push({
      id: 'temp-critical',
      tone: 'critical',
      title: 'Cảnh báo nhiệt độ rất cao',
      message: `Nhiệt độ đạt ${sensors.temperature.toFixed(1)}°C (> 35°C).`,
    });
  } else if (typeof sensors.temperature === 'number' && sensors.temperature > 28) {
    alerts.push({
      id: 'temp-warning',
      tone: 'warning',
      title: 'Nhiệt độ vượt ngưỡng',
      message: `Nhiệt độ đạt ${sensors.temperature.toFixed(1)}°C (> 28°C).`,
    });
  }

  if (typeof sensors.humidity === 'number' && sensors.humidity > 85) {
    alerts.push({
      id: 'hum-critical',
      tone: 'critical',
      title: 'Cảnh báo độ ẩm rất cao',
      message: `Độ ẩm đạt ${sensors.humidity.toFixed(1)}% (> 85%).`,
    });
  } else if (typeof sensors.humidity === 'number' && sensors.humidity > 70) {
    alerts.push({
      id: 'hum-warning',
      tone: 'warning',
      title: 'Độ ẩm cao',
      message: `Độ ẩm đạt ${sensors.humidity.toFixed(1)}% (> 70%).`,
    });
  }

  if (typeof sensors.light === 'number' && sensors.light >= 0 && sensors.light < 100) {
    alerts.push({
      id: 'lux-low',
      tone: 'warning',
      title: 'Ánh sáng yếu',
      message: `Cường độ ánh sáng hiện tại ${Math.round(sensors.light)} Lux (< 100 Lux).`,
    });
  }

  return alerts;
}

async function getChartPoints(limit = 15) {
  if (!pool) return [];
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 100);
  const [rows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(ds.timestamp, '%H:%i:%s') AS time,
      DATE_FORMAT(ds.timestamp, '%Y-%m-%d %H:%i:%s') AS fullTime,
      MAX(CASE WHEN s.type = 'TEMPERATURE' THEN ds.value END) AS temp,
      MAX(CASE WHEN s.type = 'HUMIDITY' THEN ds.value END) AS hum,
      MAX(CASE WHEN s.type = 'LIGHT' THEN ds.value END) AS lux
    FROM DataSensor ds
    INNER JOIN Sensors s ON ds.sensor_id = s.sensor_id
    GROUP BY ds.timestamp
    ORDER BY ds.timestamp DESC
    LIMIT ?
    `,
    [safeLimit]
  );

  return rows.reverse().map((r) => ({
    time: r.time,
    fullTime: r.fullTime,
    temp: r.temp !== null ? Number(r.temp) : null,
    hum: r.hum !== null ? Number(r.hum) : null,
    lux: r.lux !== null ? Number(r.lux) : null,
  }));
}

// ==========================================
// 3. MIDDLEWARE KIỂM TRA API KEY (401)
// ==========================================
function extractApiKey(req) {
  const headerKey = req.headers['x-api-key'];
  if (headerKey && String(headerKey).trim()) {
    return String(headerKey).trim();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && String(authHeader).trim()) {
    const raw = String(authHeader).trim();
    if (raw.toLowerCase().startsWith('bearer ')) {
      return raw.slice(7).trim();
    }
    return raw;
  }

  if (req.query && req.query.api_key) {
    return String(req.query.api_key).trim();
  }

  if (req.body && req.body.api_key) {
    return String(req.body.api_key).trim();
  }

  return null;
}

async function findActiveUserByApiKey(apiKey) {
  const decoded = decodeSignedApiKey(apiKey);
  if (!decoded || !pool) return null;

  const [rows] = await pool.query(
    `SELECT user_id, username, fullname, email, student_id, DATE_FORMAT(dob, '%Y-%m-%d') AS dob, gender, phone, address, school, major, cohort, github_link, figma_link, avatar, postman_url, UNIX_TIMESTAMP(updated_at) AS updated_epoch FROM User WHERE user_id = ? LIMIT 1`,
    [decoded.uid]
  );
  const user = rows[0];
  if (!user) return null;

  if (user.updated_epoch && Math.floor(decoded.iat / 1000) < Number(user.updated_epoch)) {
    return null;
  }

  return {
    id: user.user_id,
    user_id: user.user_id,
    username: user.username,
    fullName: user.fullname,
    fullname: user.fullname,
    email: user.email,
    student_id: user.student_id,
    dob: user.dob,
    gender: user.gender,
    phone: user.phone,
    address: user.address,
    school: user.school,
    major: user.major,
    cohort: user.cohort,
    github_link: user.github_link,
    figma_link: user.figma_link,
    avatar: user.avatar,
    postman_url: user.postman_url,
  };
}

async function requireApiKey(req, res, next) {
  try {
    const apiKey = extractApiKey(req);
    const user = await findActiveUserByApiKey(apiKey);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Thiếu API key hoặc API key đã hết hiệu lực / đã đăng xuất. Vui lòng đăng nhập lại!',
      });
    }

    req.apiKey = apiKey;
    req.user = user;
    return next();
  } catch (err) {
    console.error('❌ [Auth] Lỗi kiểm tra API Key:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi kiểm tra xác thực MySQL' });
  }
}

// ==========================================
// 4. KẾT NỐI MQTT BROKER (ESP32)
// ==========================================
const clientId = `Backend_B23DCAT015_${Math.random().toString(16).substring(2, 8)}`;
const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId,
  clean: true,
  connectTimeout: 5000,
  reconnectPeriod: 3000,
});

mqttClient.on('connect', () => {
  systemStatus.mqttConnected = true;
  systemStatus.lastMqttError = null;
  console.log(`\n======================================================`);
  console.log(`✅ [MQTT] Đã kết nối thành công tới: ${MQTT_BROKER}`);
  console.log(`🆔 [MQTT] Client ID: ${clientId}`);
  console.log(`======================================================\n`);

  const topicsToSub = Array.from(
    new Set([
      TOPIC_SENSOR,
      TOPIC_RESPOND,
      `ecoliving/${TOPIC_SENSOR}`,
      `ecoliving/${TOPIC_RESPOND}`,
      'ecoliving/dvstatus',
      'dvstatus',
      'ssdata',
      'dvrespond',
    ])
  );

  mqttClient.subscribe(topicsToSub, (err) => {
    if (!err) {
      console.log(`📡 [MQTT] Đang lắng nghe:`);
      console.log(`   - Topics cảm biến  : "${TOPIC_SENSOR}", "ecoliving/${TOPIC_SENSOR}"`);
      console.log(`   - Topics phản hồi  : "${TOPIC_RESPOND}", "ecoliving/${TOPIC_RESPOND}", "ecoliving/dvstatus"`);
      console.log(`   - Topics điều khiển: "${TOPIC_CONTROL}" (chiều gửi đi)\n`);
    } else {
      console.error(`❌ [MQTT] Lỗi subscribe:`, err.message);
    }
  });

  io.emit('system_status', { mqtt: true });
});

mqttClient.on('error', (err) => {
  systemStatus.mqttConnected = false;
  systemStatus.lastMqttError = err.message;
  console.error(`⚠️ [MQTT] Lỗi kết nối:`, err.message);
  io.emit('system_status', { mqtt: false });
});

mqttClient.on('close', () => {
  systemStatus.mqttConnected = false;
  io.emit('system_status', { mqtt: false });
});

mqttClient.on('message', async (topic, payloadBuffer) => {
  const payloadStr = payloadBuffer.toString().trim();
  const now = new Date();
  const timestampStr = formatLocalTimestamp(now);
  const timestampMsStr = formatLocalTimestamp(now, true);

  // 4.1. NHẬN DỮ LIỆU CẢM BIẾN THẬT TỪ ESP32
  if (topic === TOPIC_SENSOR || topic.endsWith('/' + TOPIC_SENSOR) || topic.endsWith('/ssdata')) {
    try {
      const data = JSON.parse(payloadStr);
      const temp = parseFloat(data.tem ?? data.temperature);
      const humid = parseFloat(data.humid ?? data.humidity);
      const lux = parseFloat(data.lux ?? data.light);

      if (Number.isNaN(temp) || Number.isNaN(humid) || Number.isNaN(lux)) {
        console.warn(`⚠️ [MQTT] Gói tin thiếu chỉ số hợp lệ: ${payloadStr}`);
        return;
      }

      const tempStatus = temp > 35 ? 'CRITICAL' : temp > 28 ? 'WARNING' : 'NORMAL';
      const humStatus = humid > 85 ? 'CRITICAL' : humid > 70 ? 'WARNING' : 'NORMAL';
      const luxStatus = lux < 100 || lux > 1000 ? 'WARNING' : 'NORMAL';

      latestSensors = {
        temperature: temp,
        humidity: humid,
        light: lux,
        tempStatus,
        humStatus,
        luxStatus,
        timestamp: timestampStr,
        hasData: true,
      };

      console.log(
        `🌡️ [ESP32 -> Cảm biến]: Nhiệt độ: ${temp.toFixed(1)}°C | Độ ẩm: ${humid.toFixed(1)}% | Ánh sáng: ${lux.toFixed(0)} lx`
      );

      if (pool) {
        await pool.query(
          `INSERT INTO DataSensor (value, timestamp, sensor_id, alert_status)
           VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
          [
            temp, timestampStr, SENSOR_IDS.TEMPERATURE, tempStatus,
            humid, timestampStr, SENSOR_IDS.HUMIDITY, humStatus,
            lux, timestampStr, SENSOR_IDS.LIGHT, luxStatus,
          ]
        );
        await Promise.all([
          pool.query(`UPDATE Sensors SET status = ? WHERE sensor_id = ?`, [tempStatus, SENSOR_IDS.TEMPERATURE]),
          pool.query(`UPDATE Sensors SET status = ? WHERE sensor_id = ?`, [humStatus, SENSOR_IDS.HUMIDITY]),
          pool.query(`UPDATE Sensors SET status = ? WHERE sensor_id = ?`, [luxStatus, SENSOR_IDS.LIGHT]),
        ]);
      }

      io.emit('sensor_update', {
        ...latestSensors,
        alerts: evaluateAlerts(latestSensors),
        chartPoint: {
          time: timestampStr.slice(11, 19),
          fullTime: timestampStr,
          temp,
          hum: humid,
          lux,
        },
      });
    } catch (err) {
      console.error(`⚠️ [MQTT] Không thể xử lý gói tin cảm biến "${payloadStr}":`, err.message);
    }
  }

  // 4.2. NHẬN PHẢN HỒI TRẠNG THÁI THỰC TẾ CỦA THIẾT BỊ TỪ ESP32 (HARDWARE ACK)
  if (
    topic === TOPIC_RESPOND ||
    topic.endsWith('/' + TOPIC_RESPOND) ||
    topic.endsWith('/dvrespond') ||
    topic.endsWith('/dvstatus') ||
    topic === 'dvstatus'
  ) {
    try {
      const data = JSON.parse(payloadStr);
      console.log(`💡 [ESP32 -> Phản hồi thiết bị]:`, data);

      const prevStates = {
        led1: latestDevices.led1.state,
        led2: latestDevices.led2.state,
        led3: latestDevices.led3.state,
      };

      for (const devKey of ['led1', 'led2', 'led3']) {
        const upper = devKey.toUpperCase();
        if (data[upper]) {
          latestDevices[devKey].state = data[upper] === 'ON' ? 'ON' : 'OFF';
          latestDevices[devKey].lastUpdated = timestampStr;
          if (pool) {
            await pool.query(`UPDATE Devices SET status = ? WHERE device_id = ?`, [
              latestDevices[devKey].state,
              DEVICE_SPECS[devKey].dbId,
            ]);
          }
        }
      }

      const matchedDevices = new Set();
      for (const [key, cmd] of pendingCommands.entries()) {
        const devKeyUpper = cmd.device.toUpperCase();
        const ackState = data[devKeyUpper];
        if (ackState) {
          const ackNorm = ackState === 'ON' ? 'ON' : 'OFF';
          const latencyMs = Math.max(0, Date.now() - cmd.startTime);
          const latencySec = (latencyMs / 1000).toFixed(2);
          const ackDt = formatLocalTimestamp(new Date(cmd.startTime + latencyMs), true);
          const responseTimeWithAck = `${ackDt.slice(0, 19)} (${latencySec}s)`;

          if (pool) {
            await pool.query(`UPDATE Action_history SET status = ?, response_time = ? WHERE action_id = ?`, [
              ackNorm,
              ackDt,
              cmd.logId,
            ]);
          }

          console.log(`⏱️ [Hardware ACK]: Lệnh ${cmd.device} hoàn tất sau ${latencyMs}ms (ACK: ${ackNorm})`);

          io.emit('action_ack', {
            id: cmd.logId,
            device: cmd.device,
            status: ackNorm,
            latencyMs,
            responseTime: responseTimeWithAck,
          });

          matchedDevices.add(cmd.device);
          pendingCommands.delete(key);
        }
      }

      // Ghi nhận nếu ESP32 tự động thay đổi trạng thái theo ngưỡng (không phải lệnh từ web)
      if (hasInitialDeviceSnapshot) {
        for (const devKey of ['led1', 'led2', 'led3']) {
          const newState = latestDevices[devKey].state;
          if (!matchedDevices.has(devKey) && newState !== prevStates[devKey]) {
            const spec = DEVICE_SPECS[devKey];
            latestDevices[devKey].auto = true;
            if (pool) {
              await pool.query(`UPDATE Devices SET status = ?, mode = 'Auto' WHERE device_id = ?`, [
                newState,
                spec.dbId,
              ]);
              await pool.query(
                `INSERT INTO Action_history (action_type, status, user_id, device_id, created_at, activation_time, response_time)
                 VALUES (?, ?, NULL, ?, ?, ?, ?)`,
                [newState, newState, spec.dbId, timestampMsStr, timestampMsStr, timestampMsStr]
              );
            }
          }
        }
      }
      hasInitialDeviceSnapshot = true;

      io.emit('device_update', latestDevices);
    } catch (err) {
      console.error(`⚠️ [MQTT] Không thể xử lý phản hồi thiết bị "${payloadStr}":`, err.message);
    }
  }
});

// ==========================================
// 5. CÁC API XÁC THỰC (ĐĂNG NHẬP / ĐĂNG XUẤT)
// ==========================================
app.post(['/api/login', '/api/auth/login', '/api/login.php'], async (req, res) => {
  try {
    const identifier = String(req.body?.username ?? req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ username và password',
      });
    }

    const [rows] = await pool.query(
      'SELECT * FROM `User` WHERE username = ? OR student_id = ? OR email = ? LIMIT 1',
      [identifier, identifier, identifier]
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác',
      });
    }

    const apiKey = signApiKey(user);

    return res.json({
      success: true,
      message: 'Đăng nhập thành công',
      api_key: apiKey,
      user: {
        id: user.user_id,
        username: user.username,
        fullName: user.fullname,
      },
    });
  } catch (err) {
    console.error('❌ [Login] Lỗi MySQL:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập' });
  }
});

app.post(['/api/logout', '/api/auth/logout', '/api/logout.php'], requireApiKey, async (req, res) => {
  try {
    revokedApiKeys.add(req.apiKey);
    await pool.query('UPDATE `User` SET updated_at = NOW() WHERE user_id = ?', [req.user.id]);

    return res.json({
      success: true,
      message: 'Đã đăng xuất và thu hồi API key thành công',
    });
  } catch (err) {
    console.error('❌ [Logout] Lỗi MySQL:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi khi đăng xuất' });
  }
});

app.get(['/api/me', '/api/user'], requireApiKey, (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

app.get(['/api/devices', '/api/devices/list'], requireApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT device_id, device_name, status, mode, device_type, description, DATE_FORMAT(updated_at, "%Y-%m-%d %H:%i:%s") AS updated_at FROM `Devices` ORDER BY device_id ASC'
    );
    return res.json({
      success: true,
      data: rows,
      devices: latestDevices,
    });
  } catch (err) {
    console.error('❌ [Devices] Lỗi MySQL:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi truy vấn danh mục thiết bị từ MySQL' });
  }
});

// ==========================================
// 6. TRANG TRẠNG THÁI & HEALTH CHECK (CÔNG KHAI)
// ==========================================
app.get('/', async (req, res) => {
  let sensorCount = 0;
  let actionCount = 0;
  try {
    if (pool) {
      const [[sRow]] = await pool.query('SELECT COUNT(*) AS count FROM DataSensor');
      const [[aRow]] = await pool.query('SELECT COUNT(*) AS count FROM Action_history');
      sensorCount = sRow.count;
      actionCount = aRow.count;
    }
  } catch (err) {
    console.error('⚠️ [Status Page] Lỗi truy vấn MySQL:', err.message);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>EcoLiving IoT — Backend Server Status</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; line-height: 1.6; }
        .card { max-width: 680px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid #334155; }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
        .badge-online { background: #065f46; color: #34d399; }
        .badge-offline { background: #7f1d1d; color: #f87171; }
        h1 { margin-top: 0; font-size: 24px; color: #38bdf8; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
        .box { background: #0f172a; padding: 16px; border-radius: 12px; border: 1px solid #334155; }
        .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .value { font-size: 20px; font-weight: 700; margin-top: 4px; color: #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h1>🌿 EcoLiving IoT Backend</h1>
          <span class="badge ${systemStatus.mqttConnected ? 'badge-online' : 'badge-offline'}">
            ${systemStatus.mqttConnected ? '● MQTT ONLINE' : '○ MQTT OFFLINE'}
          </span>
        </div>
        <p style="color: #94a3b8; font-size: 14px;">
          Máy chủ Backend Node.js kết nối ESP32 qua MQTT, lưu trữ MySQL (${DB_NAME}) và bảo vệ API bằng API Key.
        </p>
        <div class="grid">
          <div class="box">
            <div class="label">Cổng Server</div>
            <div class="value">Port ${PORT}</div>
          </div>
          <div class="box">
            <div class="label">MQTT Broker</div>
            <div class="value" style="font-size: 15px; word-break: break-all;">${MQTT_BROKER}</div>
          </div>
          <div class="box">
            <div class="label">Bản ghi cảm biến (MySQL)</div>
            <div class="value" style="color: #38bdf8;">${sensorCount} bản ghi</div>
          </div>
          <div class="box">
            <div class="label">Nhật ký điều khiển</div>
            <div class="value" style="color: #a855f7;">${actionCount} bản ghi</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/status', async (req, res) => {
  let dbAlive = false;
  if (pool) {
    try {
      await pool.query('SELECT 1');
      dbAlive = true;
    } catch {
      dbAlive = false;
    }
  }
  systemStatus.databaseConnected = dbAlive;

  res.json({
    success: true,
    mqtt: systemStatus.mqttConnected,
    broker: MQTT_BROKER,
    topics: { sensor: TOPIC_SENSOR, control: TOPIC_CONTROL, respond: TOPIC_RESPOND },
    database: 'MySQL',
    databaseName: DB_NAME,
    databaseConnected: dbAlive,
    connectedWebClients: systemStatus.clientConnectedCount,
  });
});

// ==========================================
// 7. CÁC API XEM DỮ LIỆU (YÊU CẦU API KEY)
// ==========================================
app.get(['/api/dashboard', '/api/dashboard.php', '/api/dashboard/overview'], requireApiKey, async (req, res) => {
  try {
    const [[sRow]] = await pool.query('SELECT COUNT(*) AS count FROM DataSensor');
    const [[aRow]] = await pool.query('SELECT COUNT(*) AS count FROM Action_history');
    const chart = await getChartPoints(15);

    res.json({
      success: true,
      sensors: latestSensors,
      devices: latestDevices,
      chart,
      alerts: evaluateAlerts(latestSensors),
      mqtt: systemStatus.mqttConnected,
      database: 'MySQL',
      totals: {
        sensors: sRow.count,
        actions: aRow.count,
      },
    });
  } catch (err) {
    console.error('❌ [Dashboard] Lỗi MySQL:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi truy vấn dữ liệu Dashboard từ MySQL' });
  }
});

app.get('/api/sensors/latest', requireApiKey, (req, res) => {
  res.json({
    success: true,
    data: latestSensors,
    devices: latestDevices,
  });
});

app.get('/api/sensors/chart', requireApiKey, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
    const data = await getChartPoints(limit);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('❌ [Chart] Lỗi MySQL:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi truy vấn biểu đồ cảm biến' });
  }
});

app.get(['/api/sensors/history', '/api/sensors.php', '/api/sensors/data'], requireApiKey, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const offset = (page - 1) * limit;

    const type = String(req.query.type || 'ALL').trim().toUpperCase();
    const status = String(req.query.status || 'ALL').trim().toUpperCase();
    const search = String(req.query.search || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const allowedSortCols = {
      id: 'ds.data_id',
      sensorName: 's.sensor_name',
      sensor_name: 's.sensor_name',
      value: 'ds.value',
      timestamp: 'ds.timestamp',
      created_at: 'ds.timestamp',
    };
    const sortCol = allowedSortCols[req.query.sortBy] || 'ds.data_id';
    const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (type !== 'ALL' && type !== 'TIME') {
      whereClause += ' AND s.type = ?';
      params.push(type);
    }

    if (status !== 'ALL') {
      whereClause += ' AND ds.alert_status = ?';
      params.push(status);
    }

    if (from) {
      whereClause += ' AND ds.timestamp >= ?';
      params.push(from);
    }

    if (to) {
      whereClause += ' AND ds.timestamp <= ?';
      params.push(to.length === 10 ? `${to} 23:59:59` : to);
    }

    if (search) {
      const normalizedSearch = search.replace(/\//g, '-');
      const vnDateMatch = normalizedSearch.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(.*))?$/);
      const isoDateSearch = vnDateMatch
        ? `${vnDateMatch[3]}-${vnDateMatch[2]}-${vnDateMatch[1]}${vnDateMatch[4] ? ` ${vnDateMatch[4]}` : ''}`
        : normalizedSearch;

      const compMatch = search.match(/^([><]=?|=)\s*([0-9]+(?:\.[0-9]+)?)$/);
      if (type === 'TIME') {
        whereClause += " AND DATE_FORMAT(ds.timestamp, '%Y-%m-%d %H:%i:%s') LIKE ?";
        params.push(`%${isoDateSearch}%`);
      } else if (compMatch) {
        const op = compMatch[1];
        const numVal = parseFloat(compMatch[2]);
        whereClause += ` AND ds.value ${op} ?`;
        params.push(numVal);
      } else {
        whereClause +=
          " AND (CAST(ds.data_id AS CHAR) LIKE ? OR s.sensor_name LIKE ? OR s.location LIKE ? OR CAST(ds.value AS CHAR) LIKE ? OR s.unit LIKE ? OR DATE_FORMAT(ds.timestamp, '%Y-%m-%d %H:%i:%s') LIKE ?)";
        const term = `%${search}%`;
        const dateTerm = `%${isoDateSearch}%`;
        params.push(term, term, term, term, term, dateTerm);
      }
    }

    const baseFrom = 'FROM DataSensor ds INNER JOIN Sensors s ON ds.sensor_id = s.sensor_id';
    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS count ${baseFrom}${whereClause}`, params);
    const total = countRow.count;

    const [rows] = await pool.query(
      `SELECT
         ds.data_id AS id,
         s.sensor_name AS sensor_name,
         s.type AS sensor_type,
         s.location AS room,
         ds.value AS value,
         s.unit AS unit,
         ds.alert_status AS status,
         ? AS topic,
         DATE_FORMAT(ds.timestamp, '%Y-%m-%d %H:%i:%s') AS created_at,
         NULL AS raw_payload
       ${baseFrom}${whereClause}
       ORDER BY ${sortCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [TOPIC_SENSOR, ...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows.map((r) => ({ ...r, value: Number(r.value) })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('❌ [Sensors History] Lỗi MySQL:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi truy vấn lịch sử cảm biến từ MySQL' });
  }
});

app.get(['/api/actions/history', '/api/actions.php', '/api/actions/logs'], requireApiKey, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const offset = (page - 1) * limit;

    const deviceFilter = String(req.query.device || 'ALL').trim();
    const actionFilter = String(req.query.action || 'ALL').trim().toUpperCase();
    const statusFilter = String(req.query.status || 'ALL').trim().toUpperCase();
    const search = String(req.query.search || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const allowedSortCols = {
      id: 'ah.action_id',
      deviceName: 'd.device_name',
      device_name: 'd.device_name',
      sentTime: 'ah.activation_time',
      sent_time: 'ah.activation_time',
      status: 'ah.status',
    };
    const sortCol = allowedSortCols[req.query.sortBy] || 'ah.action_id';
    const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (deviceFilter.toUpperCase() !== 'ALL') {
      const resolved = resolveDevice(deviceFilter);
      if (resolved) {
        whereClause += ' AND ah.device_id = ?';
        params.push(resolved.dbId);
      } else {
        whereClause += ' AND UPPER(d.device_type) = ?';
        params.push(deviceFilter.toUpperCase());
      }
    }

    if (actionFilter !== 'ALL') {
      whereClause += ' AND ah.action_type = ?';
      params.push(actionFilter);
    }

    if (statusFilter !== 'ALL') {
      whereClause += ' AND ah.status = ?';
      params.push(statusFilter);
    }

    if (from) {
      whereClause += ' AND ah.activation_time >= ?';
      params.push(from);
    }

    if (to) {
      whereClause += ' AND ah.activation_time <= ?';
      params.push(to.length === 10 ? `${to} 23:59:59` : to);
    }

    if (search) {
      whereClause +=
        " AND (CAST(ah.action_id AS CHAR) LIKE ? OR d.device_name LIKE ? OR COALESCE(u.fullname, 'Hệ thống tự động (ESP32)') LIKE ? OR DATE_FORMAT(ah.activation_time, '%Y-%m-%d %H:%i:%s') LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const baseFrom =
      'FROM Action_history ah INNER JOIN Devices d ON ah.device_id = d.device_id LEFT JOIN User u ON ah.user_id = u.user_id';

    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS count ${baseFrom}${whereClause}`, params);
    const total = countRow.count;

    const [rows] = await pool.query(
      `SELECT
         ah.action_id AS id,
         CASE ah.device_id WHEN 1 THEN 'led1' WHEN 2 THEN 'led2' ELSE 'led3' END AS device_id,
         d.device_name AS device_name,
         d.device_type AS device_type,
         ah.action_type AS action,
         ah.status AS status,
         DATE_FORMAT(ah.activation_time, '%Y-%m-%d %H:%i:%s') AS sent_time,
         CASE
           WHEN ah.response_time IS NULL THEN 'Đang chờ phản hồi...'
           ELSE CONCAT(
             DATE_FORMAT(ah.response_time, '%Y-%m-%d %H:%i:%s'),
             ' (',
             FORMAT(GREATEST(TIMESTAMPDIFF(MICROSECOND, ah.activation_time, ah.response_time) / 1000000, 0), 2),
             's)'
           )
         END AS response_time,
         COALESCE(u.fullname, 'Hệ thống tự động (ESP32)') AS performed_by,
         CASE
           WHEN ah.response_time IS NULL THEN CONCAT('Đã gửi lệnh ', ah.action_type, ' qua MQTT topic "', ?, '"')
           WHEN ah.user_id IS NULL THEN CONCAT('ESP32 tự động chuyển trạng thái sang ', ah.status)
           ELSE CONCAT('Đã nhận Hardware ACK từ ESP32 sau ', ROUND(GREATEST(TIMESTAMPDIFF(MICROSECOND, ah.activation_time, ah.response_time) / 1000, 0)), 'ms')
         END AS detail
       ${baseFrom}${whereClause}
       ORDER BY ${sortCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [TOPIC_CONTROL, ...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('❌ [Actions History] Lỗi MySQL:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi truy vấn lịch sử điều khiển từ MySQL' });
  }
});

// ==========================================
// 8. API ĐIỀU KHIỂN THIẾT BỊ (YÊU CẦU API KEY)
// ==========================================
async function handleControlRequest(req, res) {
  try {
    const rawDevice = req.params?.id || req.body?.device || req.body?.device_id || req.body?.deviceId;
    const { action, mode = 'manual' } = req.body || {};

    const devInfo = resolveDevice(rawDevice);
    if (!devInfo) {
      return res.status(400).json({
        success: false,
        message: 'Tham số device không hợp lệ (hỗ trợ: led1, led2, led3, ac_1, fan_1, led_1)',
      });
    }

    const actionBool = mode === 'auto' ? true : parseActionFlag(action);
    if (mode !== 'auto' && actionBool === null) {
      return res.status(400).json({
        success: false,
        message: 'Tham số action không hợp lệ (hỗ trợ: ON, OFF, true, false)',
      });
    }

    const startTimeMs = Date.now();
    const sentDate = new Date(startTimeMs);
    const sentTime = formatLocalTimestamp(sentDate);
    const sentTimeMsStr = formatLocalTimestamp(sentDate, true);
    const actionLabel = mode === 'auto' ? 'AUTO' : actionBool ? 'ON' : 'OFF';

    const payloadObj = {};
    if (mode === 'auto') {
      payloadObj[`${devInfo.key}_auto`] = true;
    } else {
      payloadObj[devInfo.key] = actionBool;
    }
    const payloadStr = JSON.stringify(payloadObj);

    const dbMode = mode === 'auto' ? 'Auto' : 'Manual';
    latestDevices[devInfo.key].auto = mode === 'auto';

    await pool.query(`UPDATE Devices SET mode = ? WHERE device_id = ?`, [dbMode, devInfo.dbId]);

    const [insertRes] = await pool.query(
      `INSERT INTO Action_history (action_type, status, user_id, device_id, created_at, activation_time, response_time)
       VALUES (?, 'LOADING', ?, ?, ?, ?, NULL)`,
      [actionLabel, req.user.id, devInfo.dbId, sentTimeMsStr, sentTimeMsStr]
    );

    const logId = Number(insertRes.insertId);
    const commandId = `${devInfo.key}_${startTimeMs}_${logId}`;

    pendingCommands.set(commandId, {
      logId,
      device: devInfo.key,
      dbId: devInfo.dbId,
      deviceName: devInfo.name,
      deviceType: devInfo.type,
      action: actionLabel,
      sentTime,
      startTime: startTimeMs,
    });

    io.emit('action_created', { id: logId, device: devInfo.key, action: actionLabel, status: 'LOADING', sentTime });

    if (!systemStatus.mqttConnected) {
      return res.status(503).json({
        success: false,
        logId,
        message: 'Backend chưa kết nối được MQTT Broker nên chưa thể gửi lệnh xuống ESP32',
      });
    }

    mqttClient.publish(TOPIC_CONTROL, payloadStr, { qos: 1 }, async (err) => {
      if (err) {
        pendingCommands.delete(commandId);
        await pool.query(`UPDATE Action_history SET status = 'ERROR' WHERE action_id = ?`, [logId]).catch(() => {});
        console.error(`❌ [MQTT] Không thể gửi lệnh tới ${TOPIC_CONTROL}:`, err.message);
        return res.status(500).json({ success: false, message: 'Lỗi MQTT publish' });
      }

      console.log(`📤 [Web/API -> ESP32 qua "${TOPIC_CONTROL}"]:`, payloadStr);

      if (!TOPIC_CONTROL.startsWith('ecoliving/')) {
        mqttClient.publish(`ecoliving/${TOPIC_CONTROL}`, payloadStr, { qos: 1 }, () => {});
      }

      return res.json({
        success: true,
        logId,
        message: 'Đã gửi lệnh điều khiển xuống ESP32',
        device: devInfo.key,
        action: actionLabel,
        payload: payloadObj,
        sentTime,
      });
    });
  } catch (err) {
    console.error('❌ [Control] Lỗi xử lý điều khiển:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xử lý lệnh điều khiển' });
  }
}

app.post(['/api/control', '/api/control.php'], requireApiKey, handleControlRequest);
app.put(['/api/devices/:id/control', '/api/devices/:id'], requireApiKey, handleControlRequest);
app.patch(['/api/devices/:id/control', '/api/devices/:id'], requireApiKey, handleControlRequest);

// ==========================================
// 9. WEBSOCKET REALTIME (SOCKET.IO)
// ==========================================
io.use(async (socket, next) => {
  try {
    const apiKey = socket.handshake.auth?.apiKey || socket.handshake.headers['x-api-key'];
    const user = await findActiveUserByApiKey(apiKey);
    if (!user) {
      return next(new Error('Unauthorized'));
    }
    socket.user = user;
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  systemStatus.clientConnectedCount++;
  console.log(`🔌 [WebSocket] Client kết nối: ${socket.id} (${socket.user.username})`);

  socket.emit('initial_state', {
    sensors: latestSensors,
    devices: latestDevices,
    alerts: evaluateAlerts(latestSensors),
    mqtt: systemStatus.mqttConnected,
  });

  socket.on('disconnect', () => {
    systemStatus.clientConnectedCount = Math.max(0, systemStatus.clientConnectedCount - 1);
  });
});

// ==========================================
// 10. KHỞI CHẠY SERVER SAU KHI KẾT NỐI MYSQL
// ==========================================
initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        🌿 ECOLIVING SMART HOME IOT — BACKEND SERVER              ║
╠══════════════════════════════════════════════════════════════════╣
║  🚀 HTTP API Server      : http://localhost:${PORT}               ║
║  📡 MQTT Broker          : ${MQTT_BROKER}   ║
║  📥 Topic Cảm biến       : ${TOPIC_SENSOR}                           ║
║  📤 Topic Điều khiển     : ${TOPIC_CONTROL}                        ║
║  🔁 Topic Phản hồi (ACK) : ${TOPIC_RESPOND}                        ║
║  🐬 Database             : MySQL (${DB_HOST}:${DB_PORT}/${DB_NAME})
╚══════════════════════════════════════════════════════════════════╝
      `);
    });
  })
  .catch((err) => {
    console.error('❌ Không thể kết nối cơ sở dữ liệu MySQL:', err.message);
    process.exit(1);
  });
