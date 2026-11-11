/**
 * File này: API quản lý tài khoản /api/users (admin) và lịch sử đăng nhập /api/super/login-sessions (Super Admin).
 * Dùng ở: trang Quản trị > Người dùng (quan-tri/nguoi-dung).
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Res } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { asc, eq } from 'drizzle-orm';
import type { Response } from 'express';
import { publicUser } from '../../auth/auth.types';
import { RequireAdmin, RequireSuper } from '../../auth/decorators';
import { BlobService } from '../../blob/blob.service';
import { ApiError } from '../../common/api-error';
import { DbService, schema } from '../../db/db.service';

// Bảng users (Drizzle) và các vai trò hợp lệ.
const { users } = schema;
const ROLES = ['user', 'admin'];

/** Đổi thành mảng chữ không trùng, bỏ null (không phải mảng → []). */
const strList = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x) => x !== null && x !== undefined).map(String))] : []);
/** null/undefined → '', còn lại đổi sang chữ. */
const txt = (v: unknown) => (v === undefined || v === null ? '' : String(v));
/** Mã lỗi ràng buộc Postgres (23xxx) ~ SQLITE_CONSTRAINT của server cũ. */
const isConstraintError = (e: any) => typeof e?.code === 'string' && e.code.startsWith('23');

// Mọi route /api/users chỉ admin (hoặc Super Admin) được gọi.
@Controller('api/users')
@RequireAdmin()
export class UsersController {
  constructor(private readonly db: DbService, private readonly blob: BlobService) {}

  /** Tìm tài khoản đích theo id (chỉ lấy id + cờ Super); id sai → undefined. */
  private async target(id: string) {
    const uid = Number(id);
    if (!Number.isSafeInteger(uid)) return undefined;
    // Drizzle: SELECT id, is_super FROM users WHERE id = uid LIMIT 1.
    const [t] = await this.db.orm.select({ id: users.id, isSuper: users.isSuper }).from(users).where(eq(users.id, uid)).limit(1);
    return t;
  }

  /** GET /api/users – danh sách tài khoản (ẩn Super Admin), không kèm mật khẩu. */
  @Get()
  async list() {
    const rows = await this.db.orm.select().from(users).where(eq(users.isSuper, false)).orderBy(asc(users.id));
    // publicUser bỏ trường nhạy cảm; thêm permissions = quyền đơn hàng.
    return rows.map((u) => ({ ...publicUser(u), permissions: u.orderPermissions ?? [] }));
  }

  /** POST /api/users – tạo tài khoản mới; trùng tên đăng nhập → 409. */
  @Post()
  async create(@Body() body: any) {
    const b = body ?? {};
    if (!ROLES.includes(b.role)) throw new ApiError(400, 'Vai trò không hợp lệ.');
    try {
      // Thiếu tên đăng nhập → giả lỗi ràng buộc NOT NULL (23502) như server cũ.
      if (b.username === undefined || b.username === null) throw Object.assign(new Error('username'), { code: '23502' });
      // Băm mật khẩu (bcrypt) – không lưu mật khẩu gốc.
      const hash = await bcrypt.hash(b.password, 12);
      // Lưu ảnh đại diện lên Blob.
      const avatar = await this.blob.persistImage(b.avatar || '', 'avatars');
      // Chèn tài khoản vào DB.
      await this.db.orm.insert(users).values({
        username: String(b.username),
        passwordHash: hash,
        role: b.role,
        fullName: txt(b.fullName),
        position: txt(b.position),
        avatarUrl: avatar,
        pagePermissions: strList(b.pagePermissions),
        orderPermissions: strList(b.permissions),
      });
      return { ok: true }; // 201 (mặc định của POST) như server cũ
    } catch (e) {
      // Lỗi ràng buộc (trùng tên / thiếu tên) → 409; lỗi khác → 500.
      if (isConstraintError(e) || isConstraintError((e as { cause?: unknown } | null)?.cause)) throw new ApiError(409, 'Tên đăng nhập đã tồn tại.');
      throw new ApiError(500, 'Lỗi tạo tài khoản.');
    }
  }

  /** PATCH /api/users/:id – sửa thông tin, vai trò, quyền; không được sửa Super Admin. */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const b = body ?? {};
    // Tài khoản phải tồn tại, không phải Super Admin, vai trò hợp lệ.
    const target = await this.target(id);
    if (!target) throw new ApiError(404, 'Không tìm thấy tài khoản.');
    if (target.isSuper) throw new ApiError(403, 'Không được phép chỉnh sửa tài khoản Super Admin tại mục này.');
    if (!ROLES.includes(b.role)) throw new ApiError(400, 'Vai trò không hợp lệ.');
    try {
      const avatar = await this.blob.persistImage(b.avatar || '', 'avatars');
      // Cập nhật; quyền đơn hàng chỉ đổi khi body có gửi mảng permissions.
      await this.db.orm
        .update(users)
        .set({
          fullName: txt(b.fullName),
          position: txt(b.position),
          role: b.role,
          avatarUrl: avatar,
          pagePermissions: strList(b.pagePermissions),
          ...(Array.isArray(b.permissions) ? { orderPermissions: strList(b.permissions) } : {}),
        })
        .where(eq(users.id, target.id));
      return { ok: true };
    } catch {
      throw new ApiError(500, 'Lỗi cập nhật tài khoản.');
    }
  }

  /** PUT /api/users/:id/password – admin đặt lại mật khẩu (≥ 10 ký tự). */
  @Put(':id/password')
  async password(@Param('id') id: string, @Body() body: any) {
    const target = await this.target(id);
    if (!target) throw new ApiError(404, 'Không tìm thấy tài khoản.');
    if (target.isSuper) throw new ApiError(403, 'Không được phép đổi mật khẩu Super Admin tại mục này.');
    // Kiểm độ dài mật khẩu.
    const pass = String(body?.password || '');
    if (pass.length < 10) throw new ApiError(400, 'Mật khẩu phải có ít nhất 10 ký tự.');
    try {
      // Băm rồi lưu mật khẩu mới.
      const hash = await bcrypt.hash(pass, 12);
      await this.db.orm.update(users).set({ passwordHash: hash }).where(eq(users.id, target.id));
      return { ok: true };
    } catch {
      throw new ApiError(500, 'Lỗi đổi mật khẩu.');
    }
  }

  /** PATCH /api/users/:id/active – khóa / mở khóa tài khoản (body.active). */
  @Patch(':id/active')
  async active(@Param('id') id: string, @Body() body: any) {
    const target = await this.target(id);
    if (!target) throw new ApiError(404, 'Không tìm thấy tài khoản.');
    if (target.isSuper) throw new ApiError(403, 'Không được phép khóa/mở Super Admin tại mục này.');
    try {
      await this.db.orm.update(users).set({ isActive: Boolean(body?.active) }).where(eq(users.id, target.id));
      return { ok: true };
    } catch {
      throw new ApiError(500, 'Lỗi khóa tài khoản.');
    }
  }

  /** DELETE /api/users/:id – xóa tài khoản (không xóa được Super Admin). */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const target = await this.target(id);
    if (!target) throw new ApiError(404, 'Không tìm thấy tài khoản.');
    if (target.isSuper) throw new ApiError(403, 'Không được phép xóa Super Admin.');
    try {
      await this.db.orm.delete(users).where(eq(users.id, target.id));
      return { ok: true };
    } catch {
      throw new ApiError(500, 'Lỗi xóa tài khoản.');
    }
  }
}

/** Chỉ Super Admin được xem lịch sử đăng nhập của toàn bộ tài khoản. */
@Controller('api/super')
export class LoginSessionsController {
  constructor(private readonly db: DbService) {}

  /** GET /api/super/login-sessions – 500 phiên đăng nhập mới nhất kèm trạng thái. */
  @Get('login-sessions')
  @RequireSuper()
  async loginSessions(@Res({ passthrough: true }) res: Response) {
    const rows = await this.db.all(
      `SELECT id, username, full_name, role, is_super, login_at, last_seen_at, logout_at, ip_address, user_agent
       FROM user_sessions ORDER BY login_at DESC LIMIT 500`,
    );
    const now = Date.now();
    // Suy trạng thái từ lần hoạt động cuối: ≤2 phút đang hoạt động, ≤8 giờ chưa đăng xuất, lâu hơn có thể hết phiên.
    const sessions = rows.map((r) => {
      const last = new Date(r.last_seen_at || r.login_at).getTime() || 0;
      const status = r.logout_at
        ? 'Đã đăng xuất'
        : now - last <= 2 * 60 * 1000
          ? 'Đang hoạt động'
          : now - last <= 8 * 60 * 60 * 1000
            ? 'Chưa ghi nhận đăng xuất'
            : 'Có thể đã hết phiên';
      return { ...r, status };
    });
    // Không cho trình duyệt lưu đệm (luôn lấy số liệu mới).
    res.set('Cache-Control', 'no-store');
    return sessions;
  }
}
