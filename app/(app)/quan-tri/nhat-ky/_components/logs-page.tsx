"use client";

import { Activity, FileClock } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { PageGuard } from "@/components/shell/page-guard";
import { ActivityLog } from "./activity-log";
import { OrderHistory } from "./order-history";

type Tab = "activity" | "history";

export function LogsPage() {
  const [tab, setTab] = useState<Tab>("activity");
  return (
    <PageGuard role="admin">
      <PageHeader title="Nhật ký hoạt động" description="Lịch sử thao tác sản lượng, vận hành và quản trị theo ngày (giờ Việt Nam)." />
      <Tabs<Tab>
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          {
            value: "activity",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Activity size={14} /> Nhật ký theo ngày
              </span>
            ),
          },
          {
            value: "history",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <FileClock size={14} /> Lịch sử đơn hàng
              </span>
            ),
          },
        ]}
      />
      {tab === "activity" ? <ActivityLog /> : <OrderHistory />}
    </PageGuard>
  );
}
