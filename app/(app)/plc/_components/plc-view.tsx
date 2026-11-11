"use client";

import { Activity, Gauge } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/form";
import { PageGuard } from "@/components/shell/page-guard";
import { usePolling } from "../../van-hanh/_shared/hooks";
import { ConnectionCard } from "./connection-card";
import { HistoryPanel } from "./history-panel";
import { MachineTags } from "./machine-tags";
import type { PlcLatestResponse } from "./types";

/** Làm mới dữ liệu realtime mỗi giây như trang cũ. */
const INTERVAL = 1000;

export function PlcPage() {
  return (
    <PageGuard page="vanhanh">
      <PlcView />
    </PageGuard>
  );
}

function PlcView() {
  const [latest, setLatest] = useState<PlcLatestResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLatest(await api.get<PlcLatestResponse>("/api/plc/latest"));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  usePolling(refresh, INTERVAL);

  async function refreshNow() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <>
      <PageHeader
        title="Giám sát PLC"
        description="Dữ liệu thời gian thực và lịch sử các tag PLC gửi từ Máy B cho 4 máy."
        actions={
          <Link href="/van-hanh">
            <Button variant="secondary" icon={Gauge}>
              Xưởng vận hành
            </Button>
          </Link>
        }
      />

      <ConnectionCard latest={latest} error={error} onRefresh={refreshNow} refreshing={refreshing} />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-fg">
          <Activity size={19} className="text-brand-600" />
          Giá trị tag theo máy
        </h2>
        <SearchInput placeholder="Lọc theo tên tag…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full sm:w-72" aria-label="Lọc theo tên tag" />
      </div>
      <div className="mb-8">
        <MachineTags latest={latest} query={query} loading={!latest && !error} />
      </div>

      <HistoryPanel />
    </>
  );
}
