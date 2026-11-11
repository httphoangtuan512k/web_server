"use client";

import { Construction } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { PageGuard } from "./page-guard";

export function ComingSoon({ title, page, description }: { title: string; page: string; description: string }) {
  return (
    <PageGuard page={page}>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState icon={Construction} title="Phân hệ đang được phát triển" description="Chức năng sẽ sớm có mặt trong các bản cập nhật tới." />
      </Card>
    </PageGuard>
  );
}
