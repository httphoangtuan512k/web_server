import type { users } from '../db/schema';

/** Người dùng (Drizzle, camelCase). */
export type DbUser = typeof users.$inferSelect;

export type PageName = 'kehoach' | 'vanhanh' | 'kcs' | 'xuathang' | 'kho' | 'baotri';

/** Dạng trả về cho frontend (giữ như /api/me của server cũ, thêm orderPermissions). */
export interface PublicUser {
  id: number;
  username: string;
  fullName: string;
  position: string;
  avatar: string;
  role: string;
  isSuper: boolean;
  active: boolean;
  pagePermissions: string[];
  orderPermissions: string[];
  createdAt: Date;
}

export function publicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName || user.username,
    position: user.position || 'Nhân viên',
    avatar: user.avatarUrl || '',
    role: user.role,
    isSuper: user.isSuper,
    active: user.isActive,
    pagePermissions: user.pagePermissions ?? [],
    orderPermissions: user.orderPermissions ?? [],
    createdAt: user.createdAt,
  };
}

export const isAdminUser = (u: DbUser | undefined | null) => !!u && (u.isSuper || u.role === 'admin');
export const displayName = (u: Pick<DbUser, 'fullName' | 'username'> | undefined | null) => (u && (u.fullName || u.username)) || 'Người dùng';
export const hasPage = (u: DbUser, page: string) => isAdminUser(u) || (u.pagePermissions ?? []).includes(page);
/** Quyền thao tác đơn hàng (new | edit | vanhanh | xacnhan); admin/super luôn có. */
export const hasOrderPermission = (u: DbUser, perm: string) => isAdminUser(u) || (u.orderPermissions ?? []).includes(perm);
