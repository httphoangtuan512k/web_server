"use client";

import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtNumber, todayKey } from "@/lib/format";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ClosingsTab } from "./closings-tab";
import { EntryHistory, type HistoryEntry } from "./entry-history";
import { KBtn, KCard, KEmptyRow, KNotice, KPill, KTable, kInput, kTh } from "./kho-ui";
import { OrderEntryRow } from "./order-entry-card";
import { SuggestionList } from "./suggestion-list";
import { fmtDateKey, num, shiftDate, type ClosingDate, type DailyEntryGroup, type DailyResponse, type DailySuggestion } from "./types";

/** Chuẩn hóa phản hồi: bản chốt đời cũ chỉ có `rows` với `machine_names`. */
function normalize(j: DailyResponse) {
  let suggestions: DailySuggestion[] = j.suggestions?.length ? j.suggestions : j.rows || [];
  if (j.closed && j.rows?.length && !j.suggestions?.length) {
    suggestions = j.rows.map((x) => ({ ...x, machines: String(x.machine_names || "").split(",").map((s) => s.trim()).filter(Boolean) }));
  }
  suggestions = suggestions.map((s) => ({ ...s, machines: Array.isArray(s.machines) ? s.machines : [] }));
  return { ...j, suggestions, entries: j.entries || [] };
}

/** Thẻ số liệu có vạch màu bên trái (.stat của trang cũ). */
function Stat({ label, value, bar }: { label: string; value: number; bar: string }) {
  return (
    <div className="relative min-h-[78px] min-w-0 rounded-xl border border-[#e0e9f3] bg-[linear-gradient(145deg,#fff,#f8fbff)] p-3 text-xs font-semibold text-[#64748b] sm:min-h-[86px] sm:px-4 sm:py-[15px]">
      <span className="absolute top-3.5 bottom-3.5 left-0 w-[3px] rounded" style={{ background: bar }} />
      {label}
      <b className="mt-2 block text-[19px] leading-tight font-extrabold text-[#12345a] tabular-nums sm:text-[23px]">{fmtNumber(value, 2, "0")} tấn</b>
    </div>
  );
}

const SUMMARY_COLS = ["Đơn hàng", "Bao bì", "Cỡ hạt", "Tổng đơn", "Đã sản xuất", "Máy / sản lượng hôm nay", "Sang bao", "Còn lại", "Ghi chú", "Lưu"];
const SUMMARY_WIDTHS = ["7%", "12%", "11%", "8%", "11%", "19%", "8%", "8%", "10%", "6%"];

export function DailyTab({
  date,
  onDateChange,
  canEdit,
  closingDates,
  onClosed,
  onOpenDate,
  backup,
}: {
  date: string;
  onDateChange: (d: string) => void;
  canEdit: boolean;
  closingDates: ClosingDate[];
  onClosed?: () => void;
  onOpenDate: (d: string) => void;
  /** Chỉ Super Admin: nút "Sao lưu ngay". */
  backup?: { run: () => void; loading: boolean };
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [state, setState] = useState<{ date: string; data: DailyResponse | null; error: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rev, setRev] = useState(0);
  const [closing, setClosing] = useState(false);
  const [showClosings, setShowClosings] = useState(false);

  const apply = useCallback((d: string, raw: DailyResponse) => {
    const j = normalize(raw);
    setState({ date: d, data: j, error: "" });
    setSelected(new Set(j.suggestions.map((x) => x.order_key).filter((k) => j.entries.some((e) => e.order_key === k))));
    setRev((r) => r + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .get<DailyResponse>(`/api/warehouse/daily?date=${encodeURIComponent(date)}`)
      .then((j) => alive && apply(date, j))
      .catch((e) => alive && setState({ date, data: null, error: errorMessage(e) }));
    return () => {
      alive = false;
    };
  }, [date, apply]);

  const reload = useCallback(async () => {
    try {
      apply(date, await api.get<DailyResponse>(`/api/warehouse/daily?date=${encodeURIComponent(date)}`));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [date, apply, toast]);

  const loading = !state || state.date !== date;
  const daily = !loading ? state.data : null;
  const closed = !!daily?.closed;
  const editable = canEdit && !closed;

  const entriesByOrder = useMemo(() => new Map<string, DailyEntryGroup>((daily?.entries || []).map((g) => [g.order_key, g])), [daily]);

  const history: HistoryEntry[] = useMemo(() => {
    if (!daily) return [];
    const list: HistoryEntry[] = [];
    for (const g of daily.entries) {
      const s = daily.suggestions.find((x) => x.order_key === g.order_key);
      for (const e of g.entries || []) list.push({ ...e, order_key: g.order_key, order_number: s?.order_number || g.order_key, suggestionMachines: s?.machines || [] });
    }
    return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [daily]);

  const stats = useMemo(() => {
    const machine = history.reduce((a, e) => a + (e.machines || []).reduce((n, m) => n + num(m.quantity), 0), 0);
    const repack = history.reduce((a, e) => a + num(e.repack_qty), 0);
    const remain = (daily?.suggestions || []).reduce((a, o) => a + Math.max(0, num(o.order_total) - num(o.produced_cumulative)), 0);
    return { machine, repack, total: machine + repack, remain };
  }, [history, daily]);

  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  async function closeDay() {
    if (!canEdit) return toast.error("Bạn chưa được cấp quyền chỉnh sửa dữ liệu Kho.");
    const ok = await confirm({
      title: closed ? "Tạo bản chốt mới?" : `Chốt số liệu ngày ${fmtDateKey(date)}?`,
      message: closed
        ? "Ngày này đã chốt. Hệ thống sẽ lưu thêm một bản chốt mới; các bản chốt trước vẫn được giữ nguyên."
        : "Sau khi chốt, không thể nhập thêm hoặc sửa / xóa các lần nhập của ngày này.",
      confirmText: closed ? "Tạo bản chốt mới" : "Chốt ngày",
    });
    if (!ok) return;
    setClosing(true);
    try {
      const j = await api.post<{ ok: boolean; date: string; version: number }>("/api/warehouse/daily-close", { date });
      toast.success(`Đã lưu bản chốt số ${j.version}. Bản chốt trước vẫn được giữ nguyên.`);
      await reload();
      onClosed?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setClosing(false);
    }
  }

  const isToday = date === todayKey();
  const closedSet = useMemo(() => new Set(closingDates.map((c) => c.work_date)), [closingDates]);
  const selectedRows = (daily?.suggestions || []).filter((x) => selected.has(x.order_key));
  const status = loading ? "Đang tải..." : !daily ? state?.error || "Không tải được dữ liệu." : null;

  const arrow = "grid h-10 w-8 shrink-0 place-items-center rounded-[9px] border border-[#dce5ef] bg-[#eef3f8] text-[#12345a] transition hover:bg-[#e3ebf4]";

  return (
    <div className="space-y-[17px]">
      {/* 1. Đơn hàng được gợi ý trong ngày (thanh công cụ ngày + số liệu + bảng gợi ý) */}
      <KCard
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Đơn hàng được gợi ý trong ngày
            {closed || closedSet.has(date) ? (
              <KPill>
                <Lock size={12} /> Đã chốt
              </KPill>
            ) : null}
          </span>
        }
        description="Tự động lấy theo sự kiện “Bắt đầu chạy”, “Chạy tiếp” hoặc “Chạy thêm máy” của từng đơn và máy."
        actions={
          <>
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:flex-nowrap">
              <label htmlFor="kho-work-date" className="mr-1 shrink-0 basis-full text-xs font-bold text-[#66758a] sm:basis-auto">
                Ngày làm việc
              </label>
              <button type="button" className={arrow} aria-label="Ngày trước" title="Ngày trước" onClick={() => onDateChange(shiftDate(date, -1))}>
                <ChevronLeft size={16} />
              </button>
              <input
                id="kho-work-date"
                type="date"
                value={date}
                onChange={(e) => e.target.value && onDateChange(e.target.value)}
                className={cn(kInput, "w-auto min-w-0 flex-1 px-2.5 sm:w-[150px] sm:flex-none")}
              />
              <button type="button" className={arrow} aria-label="Ngày sau" title="Ngày sau" onClick={() => onDateChange(shiftDate(date, 1))}>
                <ChevronRight size={16} />
              </button>
              {!isToday ? (
                <button type="button" onClick={() => onDateChange(todayKey())} className="shrink-0 px-1.5 text-xs font-bold text-[#2867a5] hover:underline">
                  Hôm nay
                </button>
              ) : null}
            </div>
            <KBtn variant="secondary" onClick={reload}>
              Xem ngày
            </KBtn>
            <KBtn
              variant="secondary"
              onClick={() => setShowClosings((v) => !v)}
              aria-pressed={showClosings}
              className={showClosings ? "ring-2 ring-[#b9d3ee]" : undefined}
            >
              Lịch sử chốt ngày
            </KBtn>
            {backup ? (
              <KBtn variant="secondary" loading={backup.loading} onClick={backup.run}>
                Sao lưu ngay
              </KBtn>
            ) : null}
            <KBtn
              variant="green"
              loading={closing}
              disabled={!canEdit || loading || !daily}
              onClick={closeDay}
              title={canEdit ? undefined : "Bạn chưa được cấp quyền chỉnh sửa dữ liệu Kho."}
            >
              {closed ? "Tạo bản chốt mới" : "Chốt ngày"}
            </KBtn>
          </>
        }
      >
        <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-[13px] lg:grid-cols-4">
          <Stat label="Tổng sản lượng máy" value={stats.machine} bar="#8bb6df" />
          <Stat label="Sản lượng sang bao" value={stats.repack} bar="#49a98a" />
          <Stat label="Tổng sản lượng thực tế" value={stats.total} bar="#2867a5" />
          <Stat label="Khối lượng còn lại" value={stats.remain} bar="#d69b42" />
        </div>

        <KNotice tone={closed ? "success" : "info"}>
          {daily && closed
            ? `Đã chốt ngày ${fmtDateKey(daily.date)} · Bản chốt lần ${daily.version || 1}${daily.createdBy ? ` · ${daily.createdBy}` : ""}${
                daily.closedAt ? ` · ${fmtDateTime(daily.closedAt)}` : ""
              }. Dữ liệu đang xem là bản chụp, không bị thay đổi bởi các lần chốt sau.`
            : "Nhập sản lượng theo từng máy và sản lượng sang bao tại Kho. Tổng sản lượng = tổng các máy + sang bao; Kế hoạch tự đồng bộ. Có thể sửa / xóa bản ghi đã lưu trước khi chốt ngày."}
        </KNotice>

        <SuggestionList suggestions={daily?.suggestions || []} selected={selected} onToggle={toggle} disabled={closed} status={status} />
      </KCard>

      {/* 2. Tổng hợp sản lượng theo đơn hàng */}
      <KCard
        title="Tổng hợp sản lượng theo đơn hàng"
        description="Sản lượng đã sản xuất là số cộng dồn; có thể điều chỉnh trực tiếp để khớp số liệu thực tế. Ghi chú được lưu theo đơn hàng."
      >
        <KTable minWidth={980} maxHeight="none" fixed>
          <colgroup>
            {SUMMARY_WIDTHS.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {SUMMARY_COLS.map((h) => (
                <th key={h} className={cn(kTh, "px-2 text-center text-xs whitespace-normal")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {status ? (
              <KEmptyRow colSpan={10}>{status}</KEmptyRow>
            ) : selectedRows.length ? (
              selectedRows.map((o) => (
                <OrderEntryRow key={`${o.order_key}-${rev}`} order={o} date={date} agg={entriesByOrder.get(o.order_key)} editable={editable} onSaved={reload} />
              ))
            ) : (
              <KEmptyRow colSpan={10}>Chọn đơn hàng ở bảng phía trên để xem tổng hợp.</KEmptyRow>
            )}
          </tbody>
        </KTable>
      </KCard>

      {/* 3. Lịch sử nhập trong ngày */}
      <EntryHistory entries={history} editable={editable} onChanged={reload} status={status} />

      {/* 4. Lịch sử các lần chốt ngày (bấm "Lịch sử chốt ngày" để mở) */}
      {showClosings ? <ClosingsTab onOpenDate={onOpenDate} /> : null}
    </div>
  );
}
