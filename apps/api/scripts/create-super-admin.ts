/** Tạo/cập nhật tài khoản Super Admin: npm run create-super-admin -- <username> <password> [Họ tên] */
import * as bcrypt from 'bcryptjs';
import { getPool } from '../src/db/db.service';

async function main() {
  const [username, password, fullName = 'Super Admin'] = process.argv.slice(2);
  if (!username || !password || password.length < 10) throw new Error('Cú pháp: <username> <password ≥ 10 ký tự> [Họ tên]');
  const hash = await bcrypt.hash(password, 12);
  const pool = getPool();
  await pool.query(
    `INSERT INTO users(username, password_hash, role, is_active, is_super, full_name, position)
     VALUES($1, $2, 'admin', TRUE, TRUE, $3, 'Super Admin')
     ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash, is_super=TRUE, role='admin', is_active=TRUE`,
    [username, hash, fullName],
  );
  console.log('Đã tạo/cập nhật Super Admin:', username);
  await pool.end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
