"use client";

import { PageHeader } from "@/components/ui/card";
import { PageGuard } from "@/components/shell/page-guard";
import { BackupsCard } from "./backups-card";
import { PlcDeviceCard } from "./plc-device-card";

export function SystemPage() {
  return (
    <PageGuard role="super">
      <PageHeader title="Hệ thống" description="Sao lưu dữ liệu và quản lý kết nối thiết bị PLC. Chỉ Super Admin truy cập được." />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <BackupsCard />
        <PlcDeviceCard />
      </div>
    </PageGuard>
  );
}
