/**
 * Tiện ích quản lý tài khoản MySQL cho EcoLiving Smart Home IoT
 * Sinh viên: Nguyễn Thị Ngọc Anh - B23DCAT015
 * 
 * Cách dùng:
 * 1. Xem danh sách tài khoản:
 *    node manage_user.js list
 * 
 * 2. Đổi mật khẩu tài khoản:
 *    node manage_user.js passwd <username> <mật_khẩu_mới>
 *    Ví dụ: node manage_user.js passwd admin 654321
 * 
 * 3. Thêm tài khoản mới:
 *    node manage_user.js add <username> <password> <fullname> <email> <student_id>
 *    Ví dụ: node manage_user.js add user2 123456 "Nguyen Van B" b@ptit.edu.vn B23DCAT999
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

async function getPool() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'ecoliving_iot',
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4'
  });
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'list';
  const pool = await getPool();

  try {
    if (cmd === 'list') {
      const [rows] = await pool.query(
        'SELECT user_id, username, fullname, email, student_id, created_at, updated_at FROM `User`'
      );
      console.log('\n📋 DANH SÁCH TÀI KHOẢN TRONG MYSQL (`ecoliving_iot`):');
      console.table(rows);
    } else if (cmd === 'passwd') {
      const username = args[1];
      const newPass = args[2];
      if (!username || !newPass) {
        console.error('❌ Cú pháp: node manage_user.js passwd <username> <new_password>');
        process.exit(1);
      }
      const hashed = hashPassword(newPass);
      const [res] = await pool.query(
        'UPDATE `User` SET password = ?, updated_at = NOW() WHERE username = ? OR student_id = ? OR email = ?',
        [hashed, username, username, username]
      );
      if (res.affectedRows > 0) {
        console.log(`✅ Đã đổi mật khẩu thành công cho tài khoản "${username}"! Mật khẩu mới: ${newPass}`);
      } else {
        console.error(`❌ Không tìm thấy tài khoản nào khớp với "${username}".`);
      }
    } else if (cmd === 'add') {
      const username = args[1];
      const password = args[2];
      const fullname = args[3] || 'Người dùng mới';
      const email = args[4] || `${username}@example.com`;
      const studentId = args[5] || `SV_${username}`;

      if (!username || !password) {
        console.error('❌ Cú pháp: node manage_user.js add <username> <password> [fullname] [email] [student_id]');
        process.exit(1);
      }

      const hashed = hashPassword(password);
      await pool.query(
        `INSERT INTO \`User\` (username, password, fullname, email, student_id, dob, gender, phone, address, school, major, cohort, created_at)
         VALUES (?, ?, ?, ?, ?, '2005-01-01', 'Khác', '0123456789', 'Hà Nội', 'PTIT', 'CNTT', '2023 - 2028', CURDATE())`,
        [username, hashed, fullname, email, studentId]
      );
      console.log(`✅ Đã tạo tài khoản mới thành công!`);
      console.log(`   - Username: ${username}`);
      console.log(`   - Password: ${password}`);
      console.log(`   - Họ tên: ${fullname}`);
      console.log(`   - Email: ${email}`);
      console.log(`   - Mã SV: ${studentId}`);
    } else {
      console.log('❌ Lệnh không hợp lệ. Các lệnh hỗ trợ: list | passwd | add');
    }
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  } finally {
    await pool.end();
  }
}

main();

