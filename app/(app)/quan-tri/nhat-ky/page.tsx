// File này: trang /quan-tri/nhat-ky – Nhật ký hoạt động: ai làm gì, lúc nào; lịch sử sửa đơn.
// Dùng ở: Next.js tự gọi khi mở địa chỉ này; giao diện thật nằm trong LogsPage.
import type { Metadata } from "next";
import { LogsPage } from "./_components/logs-page";

// Tiêu đề hiện trên tab trình duyệt.
export const metadata: Metadata = { title: "Nhật ký hoạt động" };

// Trang chỉ vẽ component chính.
export default function Page() {
  return <LogsPage />;
}
