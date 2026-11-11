/**
 * File này: trang /bao-tri ("Bảo trì – Bảo dưỡng") – chỉ đặt tiêu đề tab và gọi giao diện chính ở _components/maintenance-page.tsx.
 * Dùng ở: khi người dùng mở mục "Bảo trì – Bảo dưỡng" từ trang chủ.
 */
import type { Metadata } from "next";
import { MaintenancePage } from "./_components/maintenance-page";

// Tiêu đề hiện trên tab trình duyệt.
export const metadata: Metadata = { title: "Bảo trì – Bảo dưỡng" };

/** Trang /bao-tri: hiển thị toàn bộ giao diện Bảo trì – Bảo dưỡng. */
export default function Page() {
  return <MaintenancePage />;
}
