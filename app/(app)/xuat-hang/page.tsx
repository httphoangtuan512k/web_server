/**
 * File này: trang /xuat-hang (Xuất hàng) – chưa làm, chỉ hiện "đang phát triển" 🚧.
 * Dùng ở: thẻ "Thông tin xuất hàng" trên trang chủ (cần quyền "xuathang").
 */
import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

// Tiêu đề tab trình duyệt.
export const metadata: Metadata = { title: "Xuất hàng" };

/** Trang Xuất hàng: hiện màn hình "Phân hệ đang được phát triển". */
export default function XuatHangPage() {
  return <ComingSoon title="Xuất hàng" page="xuathang" description="Lập phiếu xuất và theo dõi giao hàng." />;
}
