import type { PermOption } from "./types";

/** Quyền truy cập trang (pagePermissions) – không gồm kho_edit (tách riêng). */
export const PAGE_PERMS: PermOption[] = [
  { value: "kehoach", label: "Kế hoạch đơn hàng", short: "Kế hoạch" },
  { value: "vanhanh", label: "Vận hành máy", short: "Vận hành" },
  { value: "kcs", label: "KCS (Kiểm tra chất lượng)", short: "KCS" },
  { value: "xuathang", label: "Xuất hàng", short: "Xuất hàng" },
  { value: "kho", label: "Kho", short: "Kho" },
  { value: "baotri", label: "Bảo trì – Bảo dưỡng", short: "Bảo trì" },
];

/** Quyền chỉnh sửa dữ liệu Kho – độc lập với vai trò, kể cả Quản trị viên cũng phải được tích riêng. */
export const KHO_EDIT: PermOption = { value: "kho_edit", label: "Sửa dữ liệu kho", short: "Sửa kho" };

/** Quyền thao tác đơn hàng (permissions). */
export const ORDER_PERMS: PermOption[] = [
  { value: "new", label: "Tạo đơn", short: "Tạo đơn" },
  { value: "edit", label: "Sửa đơn", short: "Sửa đơn" },
  { value: "vanhanh", label: "Vận hành (chạy máy)", short: "Vận hành" },
  { value: "xacnhan", label: "Xác nhận hoàn thành", short: "Xác nhận" },
];

export const POSITION_SUGGESTIONS = ["Giám đốc", "Quản đốc", "Trưởng ca", "Kỹ thuật viên", "Nhân viên vận hành", "Thủ kho"];

export const ROLE_LABEL: Record<string, string> = { user: "Nhân viên", admin: "Quản trị viên" };

export const MIN_PASSWORD = 10;
export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
