import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { DbUser, PageName } from './auth.types';

export const PUBLIC_KEY = 'auth:public';
export const ROLE_KEY = 'auth:role';
export const PAGE_KEY = 'auth:page';

/** Không cần đăng nhập (vd: /api/login, PLC telemetry dùng API key, cron dùng CRON_SECRET). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** = requireAdmin của server cũ (admin hoặc super). */
export const RequireAdmin = () => SetMetadata(ROLE_KEY, 'admin');

/** = requireSuperAdmin của server cũ (super và đang active). */
export const RequireSuper = () => SetMetadata(ROLE_KEY, 'super');

/** = requirePageAccess(page) của server cũ (admin/super luôn qua). */
export const RequirePage = (page: PageName) => SetMetadata(PAGE_KEY, page);

/** Dòng users đầy đủ (snake_case) của người đang đăng nhập – tương đương getUser(req.session.user.id). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): DbUser => {
  return ctx.switchToHttp().getRequest().user;
});

/** sha256(sid) – khóa của login_sessions. */
export const SessionKey = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest().sessionKey;
});
