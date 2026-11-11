/**
 * File này: trang /plc ("Giám sát PLC") – chỉ đặt tiêu đề tab và gọi giao diện chính ở _components/plc-view.tsx.
 * Dùng ở: khi người dùng mở mục "Giám sát PLC" từ trang chủ.
 */
import type { Metadata } from "next";
import { PlcPage } from "./_components/plc-view";

// Tiêu đề hiện trên tab trình duyệt.
export const metadata: Metadata = { title: "Giám sát PLC" };

/** Trang /plc: hiển thị toàn bộ giao diện Giám sát PLC. */
export default function Page() {
  return <PlcPage />;
}
