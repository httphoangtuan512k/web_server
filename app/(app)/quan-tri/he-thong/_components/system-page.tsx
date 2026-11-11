"use client";

import { PageGuard } from "@/components/shell/page-guard";
import { PageBody, PageTopbar, TopbarLink } from "@/components/shell/page-topbar";
import { OgScreen, topbarStack } from "../../_shared/og-button";
import { BackupsCard } from "./backups-card";
import { PlcDeviceCard } from "./plc-device-card";

/** Kết nối PLC (phần cuối admin.html cũ) + sao lưu dữ liệu. Chỉ Super Admin. */
export function SystemPage() {
  return (
    <OgScreen>
      <PageGuard role="super">
        <PageTopbar
          className={topbarStack}
          title="SUPER WHITE"
          subtitle="QUẢN LÝ KẾT NỐI PLC VÀ SAO LƯU DỮ LIỆU"
          actions={<TopbarLink href="/quan-tri/nguoi-dung">← Về trang Admin</TopbarLink>}
        />
        <PageBody className="flex max-w-[1250px]! flex-col gap-4 sm:gap-5">
          <PlcDeviceCard />
          <BackupsCard />
        </PageBody>
      </PageGuard>
    </OgScreen>
  );
}
