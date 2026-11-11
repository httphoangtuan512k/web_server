/** Tài khoản – dạng trả về của GET /api/users (không gồm Super Admin). */
export interface UserAccount {
  id: number;
  username: string;
  fullName: string;
  position: string;
  avatar: string;
  role: "user" | "admin" | string;
  isSuper: boolean;
  active: boolean;
  /** kehoach | vanhanh | kcs | xuathang | kho | kho_edit | baotri */
  pagePermissions: string[];
  /** Quyền đơn hàng (khóa cũ): new | edit | vanhanh | xacnhan */
  permissions?: string[];
  /** Quyền đơn hàng (khóa mới, cùng giá trị với `permissions`). */
  orderPermissions?: string[];
}

/** Body POST /api/users và PATCH /api/users/:id. */
export interface UserPayload {
  username?: string;
  password?: string;
  fullName: string;
  position: string;
  role: "user" | "admin";
  avatar: string;
  permissions: string[];
  pagePermissions: string[];
}

/** Một dòng GET /api/super/login-sessions (khóa snake_case như server cũ). */
export interface LoginSession {
  id: number;
  user_id?: number | null;
  username: string;
  full_name: string;
  role: string;
  is_super: boolean | number;
  login_at: string;
  last_seen_at: string | null;
  logout_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  /** 'Đang hoạt động' | 'Đã đăng xuất' | 'Chưa ghi nhận đăng xuất' | 'Có thể đã hết phiên' */
  status: string;
}

export interface PermOption {
  value: string;
  label: string;
  short: string;
}

export const orderPermsOf = (u: UserAccount) => u.permissions ?? u.orderPermissions ?? [];
export const isAdminRole = (u: Pick<UserAccount, "role" | "isSuper">) => u.isSuper || u.role === "admin";
