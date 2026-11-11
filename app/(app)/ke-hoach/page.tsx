import type { Metadata } from "next";
import { KeHoachPage } from "./_components/ke-hoach-page";

export const metadata: Metadata = { title: "Kế hoạch sản xuất" };

export default function Page() {
  return <KeHoachPage />;
}
