"use client";
/**
 * File này: trang Giám sát PLC – trạng thái kết nối, giá trị tag 4 máy (làm mới mỗi giây), lịch sử PLC.
 * Dùng ở: /plc (nút "📊 Dữ liệu PLC" trên trang Xưởng vận hành).
 */

import { useCallback, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { PageGuard } from "@/components/shell/page-guard";
import { PageBody, PageTopbar, TopbarLink } from "@/components/shell/page-topbar";
import { usePolling } from "../../van-hanh/_shared/hooks";
import { ConnectionCard } from "./connection-card";
import { HistoryPanel } from "./history-panel";
import { MachineTags } from "./machine-tags";
import type { PlcLatestResponse } from "./types";

/** Làm mới dữ liệu realtime mỗi giây như trang cũ. */
const INTERVAL = 1000;

/** Trang /plc: kiểm tra quyền xem rồi hiện nội dung. */
export function PlcPage() {
  return (
    <PageGuard page="vanhanh">
      <PlcView />
    </PageGuard>
  );
}

/** Nội dung trang: tải PLC mỗi giây và ghép các khối. */
function PlcView() {
  // Dữ liệu PLC mới nhất, lỗi, chữ lọc tag, nút Làm mới đang chạy.
  const [latest, setLatest] = useState<PlcLatestResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Tải dữ liệu PLC mới nhất.
  const refresh = useCallback(async () => {
    try {
      setLatest(await api.get<PlcLatestResponse>("/api/plc/latest"));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  // Tự làm mới mỗi 1 giây.
  usePolling(refresh, INTERVAL);

  // Nút "Làm mới" bấm tay.
  async function refreshNow() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <div className="min-h-dvh bg-[#f1f5f9] text-[#172033]">
      {/* Thanh tiêu đề + nút "← Vận hành máy" */}
      <PageTopbar
        title="Giám sát dữ liệu PLC"
        color="#1e3a8a"
        backLabel="Trang chủ"
        className="[&>div:first-child]:basis-48"
        actions={<TopbarLink href="/van-hanh">← Vận hành máy</TopbarLink>}
      />
      <PageBody className="max-w-[1600px]!">
        {/* Thẻ kết nối, lưới tag 4 máy, lịch sử */}
        <ConnectionCard latest={latest} error={error} onRefresh={refreshNow} refreshing={refreshing} query={query} onQuery={setQuery} />
        <div className="mb-4">
          <MachineTags latest={latest} query={query} loading={!latest && !error} />
        </div>
        <HistoryPanel />
      </PageBody>
    </div>
  );
}
