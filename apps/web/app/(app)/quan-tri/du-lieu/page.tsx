import type { Metadata } from "next";
import { SuperDataPage } from "./_components/super-data-page";

export const metadata: Metadata = { title: "Dữ liệu gốc" };

export default function Page() {
  return <SuperDataPage />;
}
