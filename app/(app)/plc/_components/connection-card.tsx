"use client";

import { cn } from "@/lib/cn";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { useTick } from "../../van-hanh/_shared/hooks";
import { PLC_DEVICE_ID } from "../../van-hanh/_shared/plc";
import type { PlcLatestResponse } from "./types";

/** Thanh trạng thái (.toolbar cũ): thiết bị gửi, lần nhận cuối, "● Máy B Online/Offline" + nút Làm mới. */
export function ConnectionCard({
  latest,
  error,
  onRefresh,
  refreshing,
  query,
  onQuery,
}: {
  latest: PlcLatestResponse | null;
  error: string;
  onRefresh: () => void;
  refreshing: boolean;
  query: string;
  onQuery: (q: string) => void;
}) {
  useTick(1000);
  const loaded = !!latest || !!error;
  const connected = !!latest?.connected && !error;
  const machines = latest?.payload?.machines ?? {};
  const tagCount = Object.values(machines).reduce((n, m) => n + Object.keys(m ?? {}).length, 0);
  const status = !loaded ? "● Đang kiểm tra kết nối" : error ? error : connected ? "● Máy B đang Online" : "● Máy B Offline";

  return (
    <section className="mb-4 rounded-xl border border-[#dbe3ed] bg-white p-3 shadow-[0_2px_8px_#0f172a0a] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] text-[#172033]">
            Thiết bị gửi dữ liệu: <b>{latest?.device_id || PLC_DEVICE_ID}</b>
          </div>
          <div className="num text-[13px] text-[#64748b]">
            {latest?.received_at ? (
              <>
                Nhận dữ liệu cuối: {fmtDateTime(latest.received_at)} <span className="text-[#94a3b8]">({fmtRelative(latest.received_at)})</span>
              </>
            ) : (
              "Chưa nhận dữ liệu từ máy B"
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("font-bold", connected ? "text-[#15803d]" : "text-[#dc2626]")}>
            <span className={cn("inline-block", connected && "animate-pulse")}>{status}</span>
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-[7px] bg-[#1d4ed8] px-[13px] py-[9px] text-sm font-medium text-white transition hover:bg-[#1e40af] disabled:opacity-50"
          >
            Làm mới
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#eef2f7] pt-3 text-xs text-[#64748b]">
        <span>
          Mốc thời gian từ C#: <b className="num font-semibold text-[#334155]">{latest?.payload?.source_timestamp || "—"}</b>
        </span>
        <span>
          Đang nhận: <b className="num font-semibold text-[#334155]">{tagCount}</b> tag
        </span>
        {latest && !latest.connected && latest.payload ? <span className="text-[#b45309]">Đang hiển thị dữ liệu nhận lần cuối (không có dữ liệu mới trong 5 giây).</span> : null}
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Lọc theo tên tag…"
          aria-label="Lọc theo tên tag"
          className="ml-auto min-h-9 w-full rounded-[7px] border border-[#cbd5e1] bg-white px-2.5 text-sm text-[#172033] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/15 sm:w-64"
        />
      </div>
    </section>
  );
}
