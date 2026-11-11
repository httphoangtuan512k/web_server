/**
 * File này: trang /kcs (Kiểm tra chất lượng) – chưa làm, chỉ hiện "đang phát triển" 🚧.
 * Dùng ở: thẻ "Thông tin KCS" trên trang chủ (cần quyền "kcs").
 */
import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

// Tiêu đề tab trình duyệt.
export const metadata: Metadata = { title: "KCS" };

/** Trang KCS: hiện màn hình "Phân hệ đang được phát triển". */
export default function KcsPage() {
  return <ComingSoon title="KCS" page="kcs" description="Kiểm tra chất lượng sản phẩm theo lô và đơn hàng." />;
}
