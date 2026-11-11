// File này: script tạo/cập nhật tài khoản Super Admin. Dùng ở: npm run create-super-admin.
import './load-env';
/** Tạo/cập nhật tài khoản Super Admin: npm run create-super-admin -- <username> <password> [Họ tên] */
import * as bcrypt from 'bcryptjs';
import { getPool } from '../src/db/db.service';

/** Đọc tham số dòng lệnh, băm mật khẩu, ghi tài khoản vào DB. */
async function main() {
  // Lấy tên đăng nhập, mật khẩu, họ tên từ dòng lệnh; kiểm tra mật khẩu ≥ 10 ký tự.
  const [username, password, fullName = 'Super Admin'] = process.argv.slice(2);
  if (!username || !password || password.length < 10) throw new Error('Cú pháp: <username> <password ≥ 10 ký tự> [Họ tên]');
  // Băm mật khẩu (12 vòng bcrypt) – DB chỉ lưu bản băm.
  const hash = await bcrypt.hash(password, 12);
  const pool = getPool();
  // Thêm user mới; nếu tên đã có thì cập nhật mật khẩu và nâng lên Super Admin đang hoạt động.
  await pool.query(
    `INSERT INTO users(username, password_hash, role, is_active, is_super, full_name, position)
     VALUES($1, $2, 'admin', TRUE, TRUE, $3, 'Super Admin')
     ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash, is_super=TRUE, role='admin', is_active=TRUE`,
    [username, hash, fullName],
  );
  console.log('Đã tạo/cập nhật Super Admin:', username);
  await pool.end();
}
// Chạy; lỗi thì in ra và thoát với mã 1 (báo thất bại).
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
