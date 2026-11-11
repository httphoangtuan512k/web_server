/**
 * File này: kiểu dữ liệu người dùng và các hàm kiểm tra quyền (admin, quyền trang, quyền đơn hàng).
 * Dùng ở: auth.guard, auth.controller và các module nghiệp vụ.
 */
import type { users } from '../db/schema';

/** Người dùng (Drizzle, camelCase). */
export type DbUser = typeof users.$inferSelect;

/** Tên các trang có thể cấp quyền riêng. */
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

/** Chuyển dòng DB thành dữ liệu gửi cho frontend (bỏ mật khẩu, điền giá trị mặc định). */
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

/** Là admin hoặc super admin? */
export const isAdminUser = (u: DbUser | undefined | null) => !!u && (u.isSuper || u.role === 'admin');
/** Tên hiển thị: họ tên, không có thì tên đăng nhập. */
export const displayName = (u: Pick<DbUser, 'fullName' | 'username'> | undefined | null) => (u && (u.fullName || u.username)) || 'Người dùng';
/** Có quyền vào trang này? (admin luôn có). */
export const hasPage = (u: DbUser, page: string) => isAdminUser(u) || (u.pagePermissions ?? []).includes(page);
/** Quyền thao tác đơn hàng (new | edit | vanhanh | xacnhan); admin/super luôn có. */
export const hasOrderPermission = (u: DbUser, perm: string) => isAdminUser(u) || (u.orderPermissions ?? []).includes(perm);
