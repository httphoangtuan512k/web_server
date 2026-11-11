"use client";

import { DatabaseBackup, Eye, PencilLine, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { todayKey } from "@/lib/format";
import { PageGuard } from "@/components/shell/page-guard";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader, Spinner } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { ClosingsTab } from "./closings-tab";
import { DailyTab } from "./daily-tab";
import { ItemsTab } from "./items-tab";
import { TransactionsTab } from "./transactions-tab";
import type { WarehouseData } from "./types";

type TabKey = "daily" | "closings" | "goods" | "packaging" | "materials" | "transactions";

export function KhoPage() {
  return (
    <PageGuard page="kho">
      <Warehouse />
    </PageGuard>
  );
}

function Warehouse() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<WarehouseData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("daily");
  const [workDate, setWorkDate] = useState(() => todayKey());
  const [backingUp, setBackingUp] = useState(false);

  const reload = useCallback(async () => {
    try {
      const d = await api.get<WarehouseData>("/api/warehouse");
      setData(d);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .get<WarehouseData>("/api/warehouse")
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, []);

  // Quyền sửa: kho_edit (admin/super luôn có) và server cũng phải xác nhận canEdit.
  const canEdit = can("kho_edit") && (data ? data.canEdit !== false : false);

  async function backupNow() {
    if (!(await confirm({ title: "Sao lưu ngay?", message: "Tạo bản sao lưu đầy đủ dữ liệu hệ thống ngay bây giờ." }))) return;
    setBackingUp(true);
    try {
      const r = await api.post<{ ok?: boolean; name?: string; pathname?: string }>("/api/superadmin/backups");
      toast.success(`Sao lưu thành công${r?.name || r?.pathname ? `: ${r.name || r.pathname}` : "."}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBackingUp(false);
    }
  }

  const openDate = (date: string) => {
    setWorkDate(date);
    setTab("daily");
  };

  return (
    <>
      <PageHeader
        title="Quản lý kho"
        description="Sản lượng cuối ngày, tồn kho hàng hóa, bao bì và vật tư"
        actions={
          <>
            {data ? (
              canEdit ? (
                <Badge tone="success" dot>
                  <PencilLine size={12} /> Được chỉnh sửa
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <Eye size={12} /> Chỉ xem
                </Badge>
              )
            ) : null}
            {data?.isSuper ? (
              <Button variant="secondary" icon={DatabaseBackup} loading={backingUp} onClick={backupNow}>
                Sao lưu ngay
              </Button>
            ) : null}
          </>
        }
      />

      {!data ? (
        error ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-danger-600">{error}</p>
            <Button className="mt-4" variant="secondary" icon={RefreshCw} onClick={reload}>
              Thử lại
            </Button>
          </Card>
        ) : (
          <Spinner />
        )
      ) : (
        <>
          {!canEdit ? (
            <p className="mb-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-muted">
              Chế độ chỉ xem: tài khoản này chưa được cấp quyền chỉnh sửa dữ liệu Kho.
            </p>
          ) : null}
          <Tabs<TabKey>
            className="mb-5"
            value={tab}
            onChange={setTab}
            items={[
              { value: "daily", label: "Sản lượng trong ngày" },
              { value: "closings", label: "Lịch sử chốt" },
              { value: "goods", label: "Hàng hóa", count: data.goods.length },
              { value: "packaging", label: "Bao bì", count: data.packaging.length },
              { value: "materials", label: "Vật tư", count: data.materials.length },
              { value: "transactions", label: "Giao dịch" },
            ]}
          />
          {tab === "daily" ? <DailyTab date={workDate} onDateChange={setWorkDate} canEdit={canEdit} closingDates={data.closingDates} onClosed={reload} /> : null}
          {tab === "closings" ? <ClosingsTab onOpenDate={openDate} /> : null}
          {tab === "goods" || tab === "packaging" || tab === "materials" ? (
            <ItemsTab key={tab} category={tab} items={data[tab]} canEdit={canEdit} onChanged={reload} />
          ) : null}
          {tab === "transactions" ? <TransactionsTab data={data} canEdit={canEdit} onChanged={reload} /> : null}
        </>
      )}
    </>
  );
}
