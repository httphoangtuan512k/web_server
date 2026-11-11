// File này: trang /quan-tri/he-thong – Hệ thống: sao lưu dữ liệu và key kết nối PLC.
// Dùng ở: Next.js tự gọi khi mở địa chỉ này; giao diện thật nằm trong SystemPage.
import type { Metadata } from "next";
import { SystemPage } from "./_components/system-page";

// Tiêu đề hiện trên tab trình duyệt.
export const metadata: Metadata = { title: "Hệ thống" };

// Trang chỉ vẽ component chính.
export default function Page() {
  return <SystemPage />;
}
