/**
 * File này: trang /van-hanh ("Xưởng vận hành") – chỉ đặt tiêu đề tab và gọi giao diện chính ở _components/van-hanh-view.tsx.
 * Dùng ở: khi người dùng mở mục "Xưởng vận hành" từ trang chủ.
 */
import type { Metadata } from "next";
import { VanHanhPage } from "./_components/van-hanh-view";

// Tiêu đề hiện trên tab trình duyệt.
export const metadata: Metadata = { title: "Xưởng vận hành" };

/** Trang /van-hanh: hiển thị toàn bộ giao diện Xưởng vận hành. */
export default function Page() {
  return <VanHanhPage />;
}
