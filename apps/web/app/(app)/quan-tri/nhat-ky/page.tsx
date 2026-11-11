import type { Metadata } from "next";
import { LogsPage } from "./_components/logs-page";

export const metadata: Metadata = { title: "Nhật ký hoạt động" };

export default function Page() {
  return <LogsPage />;
}
