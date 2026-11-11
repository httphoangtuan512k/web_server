import type { Metadata } from "next";
import { DocumentsPage } from "./_components/documents-page";

export const metadata: Metadata = { title: "Tài liệu" };

export default function Page() {
  return <DocumentsPage />;
}
