import type { Metadata } from "next";
import { PlcPage } from "./_components/plc-view";

export const metadata: Metadata = { title: "Giám sát PLC" };

export default function Page() {
  return <PlcPage />;
}
