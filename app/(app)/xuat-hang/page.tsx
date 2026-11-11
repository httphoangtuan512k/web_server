import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "Xuất hàng" };

export default function XuatHangPage() {
  return <ComingSoon title="Xuất hàng" page="xuathang" description="Lập phiếu xuất và theo dõi giao hàng." />;
}
