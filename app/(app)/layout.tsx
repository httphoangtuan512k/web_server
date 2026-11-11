/**
 * File này: khung chung cho mọi trang sau đăng nhập (nhóm "(app)" không hiện trên URL).
 * Dùng ở: Next.js tự bọc quanh trang chủ, kế hoạch, kho…
 */
import { AppShell } from "@/components/shell/app-shell";

/** Bọc trang con trong AppShell (kiểm tra đăng nhập, hộp xác nhận). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
