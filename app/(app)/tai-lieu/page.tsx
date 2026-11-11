/**
 * File này: địa chỉ /tai-lieu – đặt tiêu đề tab và hiện trang Tài liệu.
 * Dùng ở: khi bấm "Tài liệu" ở trang chủ. Giao diện thật nằm trong DocumentsPage.
 */
import type { Metadata } from "next";
import { DocumentsPage } from "./_components/documents-page";

// Chữ hiện trên tab trình duyệt.
export const metadata: Metadata = { title: "Tài liệu" };

// Trang /tai-lieu: chỉ vẽ component DocumentsPage.
export default function Page() {
  return <DocumentsPage />;
}
