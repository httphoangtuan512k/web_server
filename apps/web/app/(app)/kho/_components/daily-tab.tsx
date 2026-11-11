"use client";

import { CalendarCheck2, ChevronLeft, ChevronRight, Factory, Lock, Package, RefreshCw, Scale, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtNumber, todayKey } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { EntryHistory, type HistoryEntry } from "./entry-history";
import { OrderEntryCard } from "./order-entry-card";
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

export function DailyTab({
  date,
  onDateChange,
  canEdit,
  closingDates,
  onClosed,
}: {
  date: string;
  onDateChange: (d: string) => void;
  canEdit: boolean;
  closingDates: ClosingDate[];
  onClosed?: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [state, setState] = useState<{ date: string; data: DailyResponse | null; error: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rev, setRev] = useState(0);
  const [closing, setClosing] = useState(false);

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

  return (
    <div className="space-y-5">
      {/* Thanh chọn ngày */}
      <Card className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="icon" icon={ChevronLeft} aria-label="Ngày trước" onClick={() => onDateChange(shiftDate(date, -1))} />
          <Input
            type="date"
            aria-label="Ngày làm việc"
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="w-[150px]"
          />
          <Button variant="secondary" size="icon" icon={ChevronRight} aria-label="Ngày sau" onClick={() => onDateChange(shiftDate(date, 1))} />
          {!isToday ? (
            <Button variant="ghost" size="sm" onClick={() => onDateChange(todayKey())}>
              Hôm nay
            </Button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-muted">
          {closed || closedSet.has(date) ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-success-700">
              <Lock size={14} /> Đã chốt
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Timer size={14} /> Chưa chốt
            </span>
          )}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="secondary" icon={RefreshCw} onClick={reload} className="flex-1 sm:flex-none">
            Tải lại
          </Button>
          {canEdit ? (
            <Button variant="success" icon={CalendarCheck2} loading={closing} disabled={loading || !daily} onClick={closeDay} className="flex-1 sm:flex-none">
              {closed ? "Tạo bản chốt mới" : "Chốt ngày"}
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sản lượng máy" value={fmtNumber(stats.machine)} unit="tấn" icon={Factory} />
        <StatCard label="Sang bao" value={fmtNumber(stats.repack)} unit="tấn" icon={Package} tone="accent" />
        <StatCard label="Tổng thực tế" value={fmtNumber(stats.total)} unit="tấn" icon={Scale} tone="success" />
        <StatCard label="Khối lượng còn lại" value={fmtNumber(stats.remain)} unit="tấn" icon={Timer} tone="warning" />
      </div>

      {daily ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
            closed ? "border-success-600/25 bg-success-50 text-success-700" : "border-brand-200 bg-brand-50 text-brand-700",
          )}
        >
          {closed
            ? `Đã chốt ngày ${fmtDateKey(daily.date)} · Bản chốt lần ${daily.version || 1}${daily.createdBy ? ` · ${daily.createdBy}` : ""}${
                daily.closedAt ? ` · ${fmtDateTime(daily.closedAt)}` : ""
              }. Dữ liệu đang xem là bản chụp, không bị thay đổi bởi các lần chốt sau.`
            : "Chọn đơn ở danh sách gợi ý để nhập sản lượng theo từng máy và sang bao. Mỗi lần lưu là một phiếu riêng và được cộng dồn; Kế hoạch tự đồng bộ. Có thể sửa / xóa phiếu trước khi chốt ngày."}
        </div>
      ) : null}

      {loading ? (
        <Card className="p-2">
          <div className="py-10 text-center text-sm text-muted">Đang tải dữ liệu ngày {fmtDateKey(date)}…</div>
        </Card>
      ) : !daily ? (
        <Card className="p-6 text-center text-sm text-danger-600">{state?.error || "Không tải được dữ liệu."}</Card>
      ) : (
        <>
          <SuggestionList suggestions={daily.suggestions} selected={selected} onToggle={toggle} disabled={closed} />

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-fg">Tổng hợp sản lượng theo đơn hàng</h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  Nhập sản lượng từng máy và sang bao rồi bấm “Lưu phiếu”. “Đã sản xuất” là số cộng dồn, có thể điều chỉnh để khớp thực tế.
                </p>
              </div>
            </div>
            {selectedRows.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {selectedRows.map((o) => (
                  <OrderEntryCard
                    key={`${o.order_key}-${rev}`}
                    order={o}
                    date={date}
                    agg={entriesByOrder.get(o.order_key)}
                    editable={editable}
                    onSaved={reload}
                  />
                ))}
              </div>
            ) : (
              <Card className="px-5 py-8 text-center text-sm text-muted">Chọn đơn hàng ở danh sách gợi ý phía trên để nhập sản lượng.</Card>
            )}
          </section>

          <EntryHistory entries={history} editable={editable} onChanged={reload} />
        </>
      )}
    </div>
  );
}
