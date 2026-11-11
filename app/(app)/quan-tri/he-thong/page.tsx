import type { Metadata } from "next";
import { SystemPage } from "./_components/system-page";

export const metadata: Metadata = { title: "Hệ thống" };

export default function Page() {
  return <SystemPage />;
}
