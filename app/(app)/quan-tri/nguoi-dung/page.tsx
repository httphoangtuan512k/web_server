// File này: trang /quan-tri/nguoi-dung – Người dùng: tài khoản, phân quyền, phiên đăng nhập.
// Dùng ở: Next.js tự gọi khi mở địa chỉ này; giao diện thật nằm trong UsersPage.
import type { Metadata } from "next";
import { UsersPage } from "./_components/users-page";

// Tiêu đề hiện trên tab trình duyệt.
export const metadata: Metadata = { title: "Người dùng" };

// Trang chỉ vẽ component chính.
export default function Page() {
  return <UsersPage />;
}
