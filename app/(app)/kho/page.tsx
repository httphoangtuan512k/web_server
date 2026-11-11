/**
 * File này: địa chỉ /kho – đặt tiêu đề tab và hiện trang Quản lý kho.
 * Dùng ở: khi bấm "Kho" ở trang chủ. Giao diện thật nằm trong KhoPage.
 */
import type { Metadata } from "next";
import { KhoPage } from "./_components/kho-page";

// Chữ hiện trên tab trình duyệt.
export const metadata: Metadata = { title: "Quản lý kho" };

// Trang /kho: chỉ vẽ component KhoPage.
export default function Page() {
  return <KhoPage />;
}
