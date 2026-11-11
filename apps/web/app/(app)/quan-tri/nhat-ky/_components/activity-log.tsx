"use client";

import { Activity, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, RefreshCw, SearchX, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { fmtDate, fmtTime, todayKey } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Spinner, StatCard } from "@/components/ui/card";
import { Input, SearchInput } from "@/components/ui/form";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useApiData } from "../../_shared/use-api-data";
import { matchesQuery, normalizeText, shiftDateKey } from "../../_shared/utils";
import { ActionBadge, ValueChange } from "./action-badge";
import { SOURCE_META, type LogItem, type LogsResponse, type LogSource } from "./types";

type SourceFilter = "all" | LogSource;

/** Nhật ký hoạt động theo ngày – GET /api/logs?date=YYYY-MM-DD. */
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

  const stats = useMemo(
    () => ({
      actors: new Set(items.map((i) => i.actor).filter(Boolean)).size,
      orders: new Set(items.map((i) => i.orderNumber).filter(Boolean)).size,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const nq = normalizeText(q.trim());
    return items.filter((it) => (source === "all" || it.source === source) && matchesQuery(nq, it.actor, it.action, it.orderNumber, it.machineName, it.detail));
  }, [items, source, q]);

  const refresh = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  const isToday = date === today;

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng thao tác" value={ready ? counts.all : "—"} icon={Activity} hint={fmtDate(`${date}T12:00:00+07:00`)} />
        <StatCard label="Người thao tác" value={ready ? stats.actors : "—"} icon={Users} tone="success" />
        <StatCard label="Đơn hàng liên quan" value={ready ? stats.orders : "—"} icon={ClipboardList} tone="accent" />
        <StatCard label="Thao tác quản trị" value={ready ? counts.audit : "—"} icon={ShieldCheck} tone="warning" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="icon" icon={ChevronLeft} aria-label="Ngày trước" title="Ngày trước" onClick={() => setDate(shiftDateKey(date, -1))} />
            <div className="relative">
              <CalendarDays size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
              <Input
                type="date"
                aria-label="Chọn ngày"
                className="w-[170px] pl-9"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              size="icon"
              icon={ChevronRight}
              aria-label="Ngày sau"
              title="Ngày sau"
              disabled={date >= today}
              onClick={() => setDate(shiftDateKey(date, 1))}
            />
            {!isToday ? (
              <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
                Hôm nay
              </Button>
            ) : null}
          </div>
          <SearchInput
            className="lg:ml-auto lg:w-80"
            placeholder="Tìm người, hành động, số đơn, máy…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={refresh} className="self-start lg:self-auto">
            Làm mới
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
          <Tabs<SourceFilter>
            value={source}
            onChange={setSource}
            items={[
              { value: "all", label: "Tất cả", count: ready ? counts.all : undefined },
              { value: "history", label: SOURCE_META.history.label, count: ready ? counts.history : undefined },
              { value: "event", label: SOURCE_META.event.label, count: ready ? counts.event : undefined },
              { value: "audit", label: SOURCE_META.audit.label, count: ready ? counts.audit : undefined },
            ]}
          />
          {ready ? (
            <p className="text-[13px] text-muted">
              {filtered.length === items.length ? (
                <>
                  <span className="num font-medium text-fg">{items.length}</span> bản ghi
                </>
              ) : (
                <>
                  Hiển thị <span className="num font-medium text-fg">{filtered.length}</span> / <span className="num">{items.length}</span> bản ghi
                </>
              )}
            </p>
          ) : null}
        </div>

        {error ? (
          <EmptyState icon={SearchX} title="Không tải được nhật ký" description={error} action={<Button variant="secondary" icon={RefreshCw} onClick={refresh}>Thử lại</Button>} />
        ) : !ready ? (
          <Spinner />
        ) : !filtered.length ? (
          <EmptyState
            icon={Activity}
            title={items.length ? "Không có bản ghi phù hợp bộ lọc" : "Không có hoạt động nào trong ngày này"}
            description={items.length ? "Thử đổi nguồn hoặc từ khóa tìm kiếm." : "Chọn ngày khác để xem nhật ký."}
          />
        ) : (
          <LogList items={filtered} />
        )}
      </Card>
    </>
  );
}

function SourceBadge({ source }: { source: LogSource }) {
  const m = SOURCE_META[source] ?? { label: source, tone: "brand" as const };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

function LogList({ items }: { items: LogItem[] }) {
  return (
    <>
      {/* Bảng – màn hình rộng */}
      <div className="hidden lg:block">
        <Table maxHeight="70vh">
          <THead>
            <tr>
              <Th>Thời gian</Th>
              <Th>Nguồn</Th>
              <Th>Người thực hiện</Th>
              <Th>Hành động</Th>
              <Th>Số đơn</Th>
              <Th>Máy</Th>
              <Th>Thay đổi</Th>
              <Th>Chi tiết</Th>
            </tr>
          </THead>
          <tbody>
            {items.map((it) => (
              <Tr key={it.id}>
                <Td className="num whitespace-nowrap text-muted">{fmtTime(it.time)}</Td>
                <Td>
                  <SourceBadge source={it.source} />
                </Td>
                <Td className="font-medium whitespace-nowrap">{it.actor || "—"}</Td>
                <Td>
                  <ActionBadge action={it.action} />
                </Td>
                <Td className="whitespace-nowrap">{it.orderNumber || <span className="text-subtle">—</span>}</Td>
                <Td className="whitespace-nowrap">{it.machineName || <span className="text-subtle">—</span>}</Td>
                <Td>
                  <ValueChange oldValue={it.oldValue} newValue={it.newValue} />
                </Td>
                <Td className="max-w-[420px] min-w-[220px] text-[13px] whitespace-normal text-muted">{it.detail || "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Dòng thời gian – điện thoại/tablet */}
      <ol className="relative px-4 py-3 sm:px-5 lg:hidden">
        {items.map((it, i) => (
          <li key={it.id} className="relative flex gap-3 pb-4 last:pb-1">
            <div className="flex w-12 shrink-0 flex-col items-end pt-0.5">
              <span className="num text-xs font-medium text-fg">{fmtTime(it.time).slice(0, 5)}</span>
            </div>
            <div className="relative flex flex-col items-center">
              <span
                className={cn(
                  "z-[1] mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-surface",
                  it.source === "audit" ? "bg-warning-600" : it.source === "event" ? "bg-accent-600" : "bg-brand-600",
                )}
              />
              {i < items.length - 1 ? <span className="absolute top-3 bottom-[-4px] w-px bg-line" /> : null}
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ActionBadge action={it.action} />
                <SourceBadge source={it.source} />
              </div>
              <p className="mt-1.5 text-sm">
                <span className="font-medium text-fg">{it.actor || "—"}</span>
                {it.orderNumber ? <span className="text-muted"> · Đơn {it.orderNumber}</span> : null}
                {it.machineName ? <span className="text-muted"> · {it.machineName}</span> : null}
              </p>
              {it.oldValue !== null || it.newValue !== null ? <ValueChange className="mt-1 text-[13px]" oldValue={it.oldValue} newValue={it.newValue} /> : null}
              {it.detail ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{it.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
