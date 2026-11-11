import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { ApiError } from '../common/api-error';
import { DbService, schema } from '../db/db.service';
import { DbUser, publicUser } from './auth.types';
import { CurrentUser, Public, SessionKey } from './decorators';
import { SessionService } from './session.service';

const { users, userSessions } = schema;

@Controller('api')
export class AuthController {
  constructor(private readonly db: DbService, private readonly sessions: SessionService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: any, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const [user] = await this.db.orm.select().from(users).where(eq(users.username, String(body?.username || '').trim())).limit(1);
    if (!user || !user.isActive || !(await bcrypt.compare(String(body?.password || ''), user.passwordHash))) {
      throw new ApiError(401, 'Sai tài khoản hoặc mật khẩu.');
    }
    const sid = this.sessions.newSid();
    await this.db.orm.insert(userSessions).values({
      sessionKey: SessionService.sessionKey(sid),
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      isSuper: user.isSuper,
      ipAddress: String(req.ip || req.socket?.remoteAddress || '').slice(0, 100),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
    });
    this.sessions.setCookie(res, this.sessions.sign(user.id, sid));
    return { ok: true, redirect: '/', user: publicUser(user) };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@SessionKey() key: string, @Res({ passthrough: true }) res: Response) {
    const now = new Date();
    await this.db.orm
      .update(userSessions)
      .set({ logoutAt: now, lastSeenAt: now })
      .where(and(eq(userSessions.sessionKey, key), isNull(userSessions.logoutAt)))
      .catch(() => undefined);
    this.sessions.clearCookie(res);
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: DbUser, @SessionKey() key: string, @Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (!user.isActive) {
      await this.db.orm.update(userSessions).set({ logoutAt: new Date() }).where(eq(userSessions.sessionKey, key)).catch(() => undefined);
      this.sessions.clearCookie(res);
      throw new ApiError(401, 'Tài khoản không hoạt động.');
    }
    return publicUser(user);
  }
}
