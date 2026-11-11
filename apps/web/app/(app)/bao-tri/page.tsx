import type { Metadata } from "next";
import { MaintenancePage } from "./_components/maintenance-page";

export const metadata: Metadata = { title: "Bảo trì – Bảo dưỡng" };

export default function Page() {
  return <MaintenancePage />;
}
