// File này: trang /quan-tri/du-lieu – Dữ liệu gốc: xem/sửa trực tiếp dữ liệu trong cơ sở dữ liệu.
// Dùng ở: Next.js tự gọi khi mở địa chỉ này; giao diện thật nằm trong SuperDataPage.
import type { Metadata } from "next";
import { SuperDataPage } from "./_components/super-data-page";

// Tiêu đề hiện trên tab trình duyệt.
export const metadata: Metadata = { title: "Dữ liệu gốc" };

// Trang chỉ vẽ component chính.
export default function Page() {
  return <SuperDataPage />;
}
