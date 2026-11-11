import {
  Boxes,
  ClipboardList,
  Cpu,
  Database,
  FileSpreadsheet,
  Gauge,
  History,
  LayoutDashboard,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Me } from "./auth";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Quyền trang cần có (pagePermissions). Không đặt = mọi người đăng nhập. */
  page?: string;
  /** 'admin' = admin hoặc super; 'super' = chỉ super. */
  role?: "admin" | "super";
  group: "main" | "admin";
  /** Trang chưa phát triển. */
  soon?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Tổng quan", description: "Bảng điều khiển chung", icon: LayoutDashboard, group: "main" },
  { href: "/ke-hoach", label: "Kế hoạch sản xuất", description: "Tạo, theo dõi và xác nhận đơn hàng", icon: ClipboardList, page: "kehoach", group: "main" },
  { href: "/van-hanh", label: "Xưởng vận hành", description: "Chạy máy, sản lượng, silo & phễu", icon: Gauge, page: "vanhanh", group: "main" },
  { href: "/plc", label: "Giám sát PLC", description: "Dữ liệu thời gian thực từ Máy B", icon: Cpu, page: "vanhanh", group: "main" },
  { href: "/kho", label: "Kho", description: "Nhập sản lượng, chốt ngày, hàng hóa – vật tư", icon: Boxes, page: "kho", group: "main" },
  { href: "/kcs", label: "KCS", description: "Kiểm tra chất lượng sản phẩm", icon: ShieldCheck, page: "kcs", group: "main", soon: true },
  { href: "/xuat-hang", label: "Xuất hàng", description: "Quản lý giao hàng", icon: Truck, page: "xuathang", group: "main", soon: true },
  { href: "/bao-tri", label: "Bảo trì – Bảo dưỡng", description: "Ghi nhận sự cố và sửa chữa thiết bị", icon: Wrench, page: "baotri", group: "main" },
  { href: "/tai-lieu", label: "Tài liệu", description: "Kho tài liệu Excel dùng chung", icon: FileSpreadsheet, group: "main" },
  { href: "/quan-tri/nguoi-dung", label: "Người dùng", description: "Tài khoản, phân quyền, phiên đăng nhập", icon: Users, role: "admin", group: "admin" },
  { href: "/quan-tri/nhat-ky", label: "Nhật ký hoạt động", description: "Lịch sử thao tác & audit log", icon: History, role: "admin", group: "admin" },
  { href: "/quan-tri/he-thong", label: "Hệ thống", description: "Sao lưu, kết nối PLC", icon: Cpu, role: "super", group: "admin" },
  { href: "/quan-tri/du-lieu", label: "Dữ liệu gốc", description: "Xem/sửa trực tiếp bảng dữ liệu", icon: Database, role: "super", group: "admin" },
];

export function canSee(item: NavItem, me: Me | null) {
  if (!me) return false;
  const isAdmin = me.isSuper || me.role === "admin";
  if (item.role === "super") return me.isSuper;
  if (item.role === "admin") return isAdmin;
  if (item.page) return isAdmin || me.pagePermissions.includes(item.page);
  return true;
}
