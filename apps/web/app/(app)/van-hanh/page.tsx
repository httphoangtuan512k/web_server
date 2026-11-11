import type { Metadata } from "next";
import { VanHanhPage } from "./_components/van-hanh-view";

export const metadata: Metadata = { title: "Xưởng vận hành" };

export default function Page() {
  return <VanHanhPage />;
}
