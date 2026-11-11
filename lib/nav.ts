/**
 * File này: danh sách thẻ chức năng trên trang chủ + quy tắc ai được thấy thẻ nào.
 * Dùng ở: trang chủ (home-parts/dashboard.tsx).
 */
import type { Me } from "./auth";

/** Thẻ chức năng trên trang chủ (giống trang chủ cũ). */
export interface NavItem {
  href: string;
  label: string;
  description: string;
  /** Biểu tượng ký tự như giao diện cũ. */
  icon: string;
  /** Quyền trang cần có (pagePermissions). Không đặt = mọi người đăng nhập. */
  page?: string;
  /** 'admin' = admin hoặc super; 'super' = chỉ super. */
  role?: "admin" | "super";
  // "main" = chức năng sản xuất, "admin" = quản trị.
  group: "main" | "admin";
}

// Các thẻ theo đúng thứ tự hiện trên trang chủ.
export const NAV: NavItem[] = [
  { href: "/ke-hoach", label: "Kế hoạch đơn hàng", description: "Quản lý đơn hàng, sản lượng và tiến độ sản xuất.", icon: "▤", page: "kehoach", group: "main" },
  { href: "/van-hanh", label: "Thông tin vận hành máy", description: "Theo dõi trạng thái máy và thông số vận hành.", icon: "◉", page: "vanhanh", group: "main" },
  { href: "/kcs", label: "Thông tin KCS", description: "Quản lý kiểm tra chất lượng và kết quả kiểm nghiệm.", icon: "✓", page: "kcs", group: "main" },
  { href: "/xuat-hang", label: "Thông tin xuất hàng", description: "Theo dõi số lượng, thời gian và tình trạng xuất hàng.", icon: "⇧", page: "xuathang", group: "main" },
  { href: "/kho", label: "Kho", description: "Quản lý nhập kho, xuất kho và số lượng tồn kho.", icon: "▦", page: "kho", group: "main" },
  { href: "/tai-lieu", label: "Quản lý tài liệu", description: "Lưu trữ file Excel, phân quyền xem và chỉnh sửa tài liệu.", icon: "📁", group: "main" },
  { href: "/bao-tri", label: "Bảo trì - Bảo dưỡng", description: "Quản lý lịch bảo trì, bảo dưỡng thiết bị và máy móc.", icon: "🛠", page: "baotri", group: "main" },
  { href: "/quan-tri/nguoi-dung", label: "Quản lý nhân sự", description: "Tài khoản, phân quyền và lịch sử đăng nhập.", icon: "👥", role: "admin", group: "admin" },
  { href: "/quan-tri/nhat-ky", label: "Lịch sử hoạt động", description: "Nhật ký thao tác sản lượng, vận hành và quản trị.", icon: "🕘", role: "admin", group: "admin" },
  { href: "/quan-tri/he-thong", label: "Hệ thống", description: "Sao lưu dữ liệu và kết nối PLC Máy B.", icon: "⚙", role: "super", group: "admin" },
  { href: "/quan-tri/du-lieu", label: "Dữ liệu gốc", description: "Xem và chỉnh sửa trực tiếp các bảng dữ liệu.", icon: "🗄", role: "super", group: "admin" },
];

/** Người dùng có được thấy thẻ này không (admin thấy mọi thẻ không phải "super"). */
export function canSee(item: NavItem, me: Me | null) {
  if (!me) return false;
  const isAdmin = me.isSuper || me.role === "admin";
  if (item.role === "super") return me.isSuper;
  if (item.role === "admin") return isAdmin;
  if (item.page) return isAdmin || me.pagePermissions.includes(item.page);
  return true;
}
