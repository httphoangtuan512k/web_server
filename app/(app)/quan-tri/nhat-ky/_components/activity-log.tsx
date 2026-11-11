"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { fmtTime, todayKey } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { OgButton, OgEmptyBox, OgEmptyRow, ogInput, OgTable, OgTd, OgTh, OgTr } from "../../_shared/og-button";
import { useApiData } from "../../_shared/use-api-data";
import { matchesQuery, normalizeText, shiftDateKey } from "../../_shared/utils";
import { ActionBadge, ValueChange } from "./action-badge";
import { SOURCE_META, type LogItem, type LogsResponse, type LogSource } from "./types";

type SourceFilter = "all" | LogSource;

const SOURCE_CLS: Record<LogSource, string> = {
  history: "bg-[#eaf1f6] text-[#172b3a]",
  event: "bg-[#e8efff] text-[#1746a2]",
  audit: "bg-[#fff7e6] text-[#92400e]",
};

function SourceTag({ source }: { source: LogSource }) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-[3px] text-xs whitespace-nowrap", SOURCE_CLS[source] ?? "bg-[#eef2f7] text-[#475569]")}>
      {SOURCE_META[source]?.label ?? source}
    </span>
  );
}

/** Nhật ký hoạt động theo ngày – GET /api/logs?date=YYYY-MM-DD. Thanh "Chọn ngày: … Xem dữ liệu" như log.html. */
export function ActivityLog() {
  const toast = useToast();
  const [today] = useState(() => todayKey());
  const [date, setDate] = useState(today);
  const [source, setSource] = useState<SourceFilter>("all");
  const [q, setQ] = useState("");
  const { data, error, loading, ready, reload } = useApiData<LogsResponse>(date ? `/api/logs?date=${encodeURIComponent(date)}` : null);

  // Chỉ hiển thị dữ liệu đúng ngày đang chọn (tránh nhầm dữ liệu ngày trước trong lúc tải).
  const items = useMemo<LogItem[]>(() => (ready && data?.items ? data.items : []), [data, ready]);

  const counts = useMemo(() => {
    const c: Record<SourceFilter, number> = { all: items.length, history: 0, event: 0, audit: 0 };
    for (const it of items) c[it.source] = (c[it.source] ?? 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const nq = normalizeText(q.trim());
    return items.filter((it) => (source === "all" || it.source === source) && matchesQuery(nq, it.actor, it.action, it.orderNumber, it.machineName, it.detail));
  }, [items, source, q]);

  const refresh = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  const status = error ? "" : !ready ? "Đang tải dữ liệu..." : filtered.length === items.length ? `Tìm thấy ${items.length} bản ghi` : `Hiển thị ${filtered.length} / ${items.length} bản ghi`;

  return (
    <>
      {/* Thanh công cụ như log.html */}
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 sm:mb-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="log-date" className="font-bold text-[#172b3a]">
            Chọn ngày:
          </label>
          <div className="flex items-center gap-1">
            <OgButton size="sm" className="min-h-[38px]! text-base!" aria-label="Ngày trước" title="Ngày trước" onClick={() => setDate(shiftDateKey(date, -1))}>
              ‹
            </OgButton>
            <input
              id="log-date"
              type="date"
              className="min-h-[38px] rounded-md border border-[#ccc] bg-white px-3 py-1.5 text-sm focus:border-[#9bbbd2] focus:ring-3 focus:ring-[#9bbbd2]/35 focus:outline-none"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <OgButton
              size="sm"
              className="min-h-[38px]! text-base!"
              aria-label="Ngày sau"
              title="Ngày sau"
              disabled={date >= today}
              onClick={() => setDate(shiftDateKey(date, 1))}
            >
              ›
            </OgButton>
          </div>
          <OgButton variant="primary" className="font-bold" loading={loading} onClick={refresh}>
            Xem dữ liệu
          </OgButton>
          {date !== today ? (
            <button type="button" onClick={() => setDate(today)} className="text-[13px] font-semibold text-[#244d68] hover:underline">
              Hôm nay
            </button>
          ) : null}
          <span className="w-full text-sm text-[#64748b] sm:ml-auto sm:w-auto">{status}</span>
        </div>
        <div className="flex flex-col gap-2 border-t border-[#e2e8f0] pt-3 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-1.5">
            {(["all", "history", "event", "audit"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSource(v)}
                aria-pressed={source === v}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors",
                  source === v ? "border-[#172b3a] bg-[#172b3a] text-white" : "border-[#dce3e9] bg-white text-[#475569] hover:bg-[#edf2f6]",
                )}
              >
                {v === "all" ? "Tất cả" : SOURCE_META[v].label}
                {ready ? <span className={cn("num text-[11px]", source === v ? "text-white/75" : "text-[#94a3b8]")}>{counts[v]}</span> : null}
              </button>
            ))}
          </div>
          <input
            type="search"
            className={cn(ogInput, "min-h-[38px]! md:ml-auto md:w-80")}
            placeholder="Tìm người, hành động, số đơn, máy…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Bảng – màn hình rộng (cột như log.html; Máy/Nguồn thay cho Mã hàng/Trạng thái vì API mới không có) */}
      <div className="hidden md:block">
        <OgTable maxHeight="70vh" minWidth={960}>
          <thead>
            <tr>
              <OgTh>Thời gian</OgTh>
              <OgTh>Tài khoản</OgTh>
              <OgTh>Hành động</OgTh>
              <OgTh>Số đơn hàng</OgTh>
              <OgTh>Máy</OgTh>
              <OgTh>Số lượng</OgTh>
              <OgTh>Nguồn</OgTh>
              <OgTh>Chi tiết thay đổi</OgTh>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <OgEmptyRow colSpan={8} tone="error">
                {error}
              </OgEmptyRow>
            ) : !ready ? (
              <OgEmptyRow colSpan={8}>Đang tải dữ liệu...</OgEmptyRow>
            ) : !filtered.length ? (
              <OgEmptyRow colSpan={8}>{items.length ? "Không có bản ghi phù hợp bộ lọc." : "Không có hoạt động nào trong ngày này."}</OgEmptyRow>
            ) : (
              filtered.map((it) => (
                <OgTr key={it.id}>
                  <OgTd className="num whitespace-nowrap text-[#64748b]">{fmtTime(it.time)}</OgTd>
                  <OgTd className="font-bold whitespace-nowrap">{it.actor || "-"}</OgTd>
                  <OgTd>
                    <ActionBadge action={it.action} />
                  </OgTd>
                  <OgTd className="whitespace-nowrap">{it.orderNumber || "-"}</OgTd>
                  <OgTd className="whitespace-nowrap">{it.machineName || "-"}</OgTd>
                  <OgTd>
                    <ValueChange oldValue={it.oldValue} newValue={it.newValue} />
                  </OgTd>
                  <OgTd>
                    <SourceTag source={it.source} />
                  </OgTd>
                  <OgTd className="max-w-[380px] min-w-[220px] text-[13px] text-[#475569]">{it.detail || "-"}</OgTd>
                </OgTr>
              ))
            )}
          </tbody>
        </OgTable>
      </div>

      {/* Thẻ – điện thoại */}
      <div className="md:hidden">
        {error ? (
          <OgEmptyBox tone="error">{error}</OgEmptyBox>
        ) : !ready ? (
          <OgEmptyBox>Đang tải dữ liệu...</OgEmptyBox>
        ) : !filtered.length ? (
          <OgEmptyBox>{items.length ? "Không có bản ghi phù hợp bộ lọc." : "Không có hoạt động nào trong ngày này."}</OgEmptyBox>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((it) => (
              <li key={it.id} className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <ActionBadge action={it.action} />
                  <span className="num shrink-0 text-xs text-[#64748b]">{fmtTime(it.time)}</span>
                </div>
                <p className="mt-2 text-sm">
                  <b>{it.actor || "-"}</b>
                  {it.orderNumber ? <span className="text-[#475569]"> · Đơn {it.orderNumber}</span> : null}
                  {it.machineName ? <span className="text-[#475569]"> · {it.machineName}</span> : null}
                </p>
                {it.oldValue !== null || it.newValue !== null ? <ValueChange className="mt-1 text-[13px]" oldValue={it.oldValue} newValue={it.newValue} /> : null}
                {it.detail ? <p className="mt-1 text-[13px] leading-relaxed text-[#475569]">{it.detail}</p> : null}
                <div className="mt-2">
                  <SourceTag source={it.source} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
