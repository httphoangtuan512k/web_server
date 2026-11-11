// File này: các hằng số cố định của trang Người dùng (danh sách quyền, chức danh gợi ý, luật mật khẩu).
// Dùng ở: form tài khoản, danh sách tài khoản, đổi mật khẩu.
import type { PermOption } from "./types";

/** Quyền truy cập trang (pagePermissions) – không gồm kho_edit (tách riêng). Nhãn & thứ tự như admin.html. */
export const PAGE_PERMS: PermOption[] = [
  { value: "kehoach", label: "Kế hoạch đơn hàng", short: "Kế hoạch" },
  { value: "vanhanh", label: "Vận hành máy", short: "Vận hành" },
  { value: "kcs", label: "KCS (Kiểm tra chất lượng)", short: "KCS" },
  { value: "xuathang", label: "Xuất hàng", short: "Xuất hàng" },
  { value: "kho", label: "Kho", short: "Kho" },
  { value: "baotri", label: "Bảo trì - Bảo dưỡng", short: "Bảo trì" },
];

/** Quyền chỉnh sửa dữ liệu Kho – độc lập với vai trò, kể cả Quản trị viên cũng phải được tích riêng. */
export const KHO_EDIT: PermOption = { value: "kho_edit", label: "Chỉnh sửa dữ liệu Kho", short: "Sửa kho" };

/** Quyền thao tác đơn hàng (permissions). */
export const ORDER_PERMS: PermOption[] = [
  { value: "new", label: "Tạo đơn mới", short: "Tạo đơn" },
  { value: "edit", label: "Sửa thông tin đơn", short: "Sửa đơn" },
  { value: "vanhanh", label: "Vận hành (Chạy máy)", short: "Vận hành" },
  { value: "xacnhan", label: "Xác nhận số liệu (Kho)", short: "Xác nhận" },
];

// Chức danh gợi ý khi gõ ô "Chức danh".
export const POSITION_SUGGESTIONS = ["Giám đốc", "Quản đốc", "Trưởng ca", "Kỹ thuật viên", "Nhân viên vận hành", "Thủ kho"];

// Tên tiếng Việt của vai trò.
export const ROLE_LABEL: Record<string, string> = { user: "Nhân viên", admin: "Quản trị viên" };

// Mật khẩu tối thiểu 10 ký tự.
export const MIN_PASSWORD = 10;
// Tên đăng nhập: 3–30 ký tự, chỉ chữ không dấu, số, _ . -
export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
