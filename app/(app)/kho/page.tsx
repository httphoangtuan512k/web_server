import type { Metadata } from "next";
import { KhoPage } from "./_components/kho-page";

export const metadata: Metadata = { title: "Quản lý kho" };

export default function Page() {
  return <KhoPage />;
}
