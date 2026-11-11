/**
 * File này: API đăng nhập (POST /api/login), đăng xuất (POST /api/logout), xem tài khoản (GET /api/me).
 * Dùng ở: trang /login và giao diện khi cần biết ai đang đăng nhập.
 */
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { ApiError } from '../common/api-error';
import { DbService, schema } from '../db/db.service';
import { publicUser } from './auth.types';
import type { DbUser } from './auth.types';
import { CurrentUser, Public, SessionKey } from './decorators';
import { SessionService } from './session.service';

// Bảng người dùng và bảng phiên đăng nhập.
const { users, userSessions } = schema;

@Controller('api')
export class AuthController {
  constructor(private readonly db: DbService, private readonly sessions: SessionService) {}

  /** Đăng nhập: kiểm tra mật khẩu, tạo phiên, gửi cookie. */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: any, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Tìm người dùng theo tên đăng nhập.
    const [user] = await this.db.orm.select().from(users).where(eq(users.username, String(body?.username || '').trim())).limit(1);
    // Không có / bị khóa / sai mật khẩu (so với bản băm bcrypt) → 401.
    if (!user || !user.isActive || !(await bcrypt.compare(String(body?.password || ''), user.passwordHash))) {
      throw new ApiError(401, 'Sai tài khoản hoặc mật khẩu.');
    }
    // Tạo mã phiên ngẫu nhiên, ghi phiên vào DB (lưu bản băm, không lưu mã gốc).
    const sid = this.sessions.newSid();
    await this.db.orm.insert(userSessions).values({
      sessionKey: SessionService.sessionKey(sid),
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      isSuper: user.isSuper,
      // IP và trình duyệt của người đăng nhập (cắt ngắn cho vừa cột).
      ipAddress: String(req.ip || req.socket?.remoteAddress || '').slice(0, 100),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
    });
    // Gửi cookie phiên đã ký cho trình duyệt.
    this.sessions.setCookie(res, this.sessions.sign(user.id, sid));
    return { ok: true, redirect: '/', user: publicUser(user) };
  }

  /** Đăng xuất: đánh dấu phiên đã kết thúc và xóa cookie. */
  @Post('logout')
  @HttpCode(200)
  async logout(@SessionKey() key: string, @Res({ passthrough: true }) res: Response) {
    const now = new Date();
    // Ghi giờ đăng xuất cho phiên đang mở; lỗi DB thì bỏ qua.
    await this.db.orm
      .update(userSessions)
      .set({ logoutAt: now, lastSeenAt: now })
      .where(and(eq(userSessions.sessionKey, key), isNull(userSessions.logoutAt)))
      .catch(() => undefined);
    this.sessions.clearCookie(res);
    return { ok: true };
  }

  /** Trả thông tin người đang đăng nhập. */
  @Get('me')
  async me(@CurrentUser() user: DbUser, @SessionKey() key: string, @Res({ passthrough: true }) res: Response) {
    // Không cho trình duyệt/proxy lưu cache câu trả lời này.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    // Tài khoản bị khóa: kết thúc phiên, xóa cookie, báo 401.
    if (!user.isActive) {
      await this.db.orm.update(userSessions).set({ logoutAt: new Date() }).where(eq(userSessions.sessionKey, key)).catch(() => undefined);
      this.sessions.clearCookie(res);
      throw new ApiError(401, 'Tài khoản không hoạt động.');
    }
    return publicUser(user);
  }
}
