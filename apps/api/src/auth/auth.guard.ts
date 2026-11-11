import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq, getTableColumns, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { ApiError } from '../common/api-error';
import { DbService, schema } from '../db/db.service';
import { DbUser, hasPage, isAdminUser, PageName } from './auth.types';
import { PAGE_KEY, PUBLIC_KEY, ROLE_KEY } from './decorators';
import { SessionService } from './session.service';

const { users, userSessions } = schema;

/**
 * Guard toàn cục: đăng nhập + @RequireAdmin + @RequireSuper + @RequirePage.
 * Gắn `req.user` (DbUser) và `req.sessionKey`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DbService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: DbUser; sessionKey?: string }>();
    const payload = this.sessions.read(req);
    if (!payload) throw new ApiError(401, 'Vui lòng đăng nhập.');

    const sessionKey = SessionService.sessionKey(payload.sid);
    const [row] = await this.db.orm
      .select({ user: getTableColumns(users), lastSeenAt: userSessions.lastSeenAt })
      .from(userSessions)
      .innerJoin(users, eq(users.id, userSessions.userId))
      .where(and(eq(userSessions.sessionKey, sessionKey), isNull(userSessions.logoutAt), eq(userSessions.userId, payload.uid)))
      .limit(1);
    if (!row) throw new ApiError(401, 'Vui lòng đăng nhập.');
    if (!row.user.isActive) {
      // Tài khoản bị khóa: thu hồi phiên ngay, không đợi cookie hết hạn.
      await this.db.orm.update(userSessions).set({ logoutAt: new Date() }).where(eq(userSessions.sessionKey, sessionKey)).catch(() => undefined);
      this.sessions.clearCookie(ctx.switchToHttp().getResponse());
      throw new ApiError(401, 'Tài khoản không hoạt động.');
    }
    req.user = row.user;
    req.sessionKey = sessionKey;

    // Cập nhật lần hoạt động gần nhất tối đa 1 phút/lần.
    const now = new Date();
    if (row.lastSeenAt.getTime() < now.getTime() - 60_000) {
      await this.db.orm
        .update(userSessions)
        .set({ lastSeenAt: now })
        .where(eq(userSessions.sessionKey, sessionKey))
        .catch(() => undefined);
    }

    const role = this.reflector.getAllAndOverride<'admin' | 'super' | undefined>(ROLE_KEY, targets);
    if (role === 'admin' && !isAdminUser(req.user)) throw new ApiError(403, 'Không có quyền quản trị.');
    if (role === 'super' && !(req.user.isActive && req.user.isSuper)) {
      throw new ApiError(403, 'Chỉ Super Admin mới được sử dụng chức năng này.');
    }
    const page = this.reflector.getAllAndOverride<PageName | undefined>(PAGE_KEY, targets);
    if (page && !hasPage(req.user, page)) throw new ApiError(403, 'Bạn không có quyền truy cập trang này.');
    return true;
  }
}
