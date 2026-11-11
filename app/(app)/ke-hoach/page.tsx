/**
 * File này: điểm vào trang /ke-hoach (Kế hoạch sản xuất).
 * Dùng ở: thẻ "Kế hoạch đơn hàng" trên trang chủ; nội dung thật nằm trong _components/.
 */
import type { Metadata } from "next";
import { KeHoachPage } from "./_components/ke-hoach-page";

// Tiêu đề tab trình duyệt.
export const metadata: Metadata = { title: "Kế hoạch sản xuất" };

/** Hiển thị toàn bộ trang kế hoạch. */
export default function Page() {
  return <KeHoachPage />;
}
