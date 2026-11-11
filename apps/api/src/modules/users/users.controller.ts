import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Res } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { asc, eq } from 'drizzle-orm';
import type { Response } from 'express';
import { publicUser } from '../../auth/auth.types';
import { RequireAdmin, RequireSuper } from '../../auth/decorators';
import { BlobService } from '../../blob/blob.service';
import { ApiError } from '../../common/api-error';
import { DbService, schema } from '../../db/db.service';

const { users } = schema;
const ROLES = ['user', 'admin'];

const strList = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x) => x !== null && x !== undefined).map(String))] : []);
const txt = (v: unknown) => (v === undefined || v === null ? '' : String(v));
/** Mã lỗi ràng buộc Postgres (23xxx) ~ SQLITE_CONSTRAINT của server cũ. */
const isConstraintError = (e: any) => typeof e?.code === 'string' && e.code.startsWith('23');

@Controller('api/users')
@RequireAdmin()
export class UsersController {
  constructor(private readonly db: DbService, private readonly blob: BlobService) {}

  private async target(id: string) {
    const uid = Number(id);
    if (!Number.isSafeInteger(uid)) return undefined;
    const [t] = await this.db.orm.select({ id: users.id, isSuper: users.isSuper }).from(users).where(eq(users.id, uid)).limit(1);
    return t;
  }

  @Get()
  async list() {
    const rows = await this.db.orm.select().from(users).where(eq(users.isSuper, false)).orderBy(asc(users.id));
    return rows.map((u) => ({ ...publicUser(u), permissions: u.orderPermissions ?? [] }));
  }

  @Post()
  async create(@Body() body: any) {
    const b = body ?? {};
    if (!ROLES.includes(b.role)) throw new ApiError(400, 'Vai trò không hợp lệ.');
    try {
      if (b.username === undefined || b.username === null) throw Object.assign(new Error('username'), { code: '23502' });
      const hash = await bcrypt.hash(b.password, 12);
      const avatar = await this.blob.persistImage(b.avatar || '', 'avatars');
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
      if (isConstraintError(e) || isConstraintError(e?.cause)) throw new ApiError(409, 'Tên đăng nhập đã tồn tại.');
      throw new ApiError(500, 'Lỗi tạo tài khoản.');
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const b = body ?? {};
    const target = await this.target(id);
    if (!target) throw new ApiError(404, 'Không tìm thấy tài khoản.');
    if (target.isSuper) throw new ApiError(403, 'Không được phép chỉnh sửa tài khoản Super Admin tại mục này.');
    if (!ROLES.includes(b.role)) throw new ApiError(400, 'Vai trò không hợp lệ.');
    try {
      const avatar = await this.blob.persistImage(b.avatar || '', 'avatars');
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

  @Put(':id/password')
  async password(@Param('id') id: string, @Body() body: any) {
    const target = await this.target(id);
    if (!target) throw new ApiError(404, 'Không tìm thấy tài khoản.');
    if (target.isSuper) throw new ApiError(403, 'Không được phép đổi mật khẩu Super Admin tại mục này.');
    const pass = String(body?.password || '');
    if (pass.length < 10) throw new ApiError(400, 'Mật khẩu phải có ít nhất 10 ký tự.');
    try {
      const hash = await bcrypt.hash(pass, 12);
      await this.db.orm.update(users).set({ passwordHash: hash }).where(eq(users.id, target.id));
      return { ok: true };
    } catch {
      throw new ApiError(500, 'Lỗi đổi mật khẩu.');
    }
  }

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

  @Get('login-sessions')
  @RequireSuper()
  async loginSessions(@Res({ passthrough: true }) res: Response) {
    const rows = await this.db.all(
      `SELECT id, username, full_name, role, is_super, login_at, last_seen_at, logout_at, ip_address, user_agent
       FROM user_sessions ORDER BY login_at DESC LIMIT 500`,
    );
    const now = Date.now();
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
    res.set('Cache-Control', 'no-store');
    return sessions;
  }
}
