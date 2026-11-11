import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "KCS" };

export default function KcsPage() {
  return <ComingSoon title="KCS" page="kcs" description="Kiểm tra chất lượng sản phẩm theo lô và đơn hàng." />;
}
