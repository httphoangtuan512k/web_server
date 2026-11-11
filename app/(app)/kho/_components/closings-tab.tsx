"use client";

import { CalendarCheck2, ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, Spinner } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/form";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { fmtDateKey, num, type DailyResponse, type DailyRow, type SnapshotRow } from "./types";

type Detail = { loading: boolean; rows: DailyRow[]; error?: string };

export function ClosingsTab({ onOpenDate }: { onOpenDate: (date: string) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<SnapshotRow[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});

  const fetchRows = useCallback(() => api.get<{ rows: SnapshotRow[] }>("/api/warehouse/snapshots"), []);

  useEffect(() => {
    let alive = true;
    fetchRows()
      .then((j) => alive && setRows(j.rows || []))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [fetchRows]);

  async function refresh() {
    try {
      setRows((await fetchRows()).rows || []);
      setDetails({});
      setError("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function toggle(date: string) {
    if (open === date) return setOpen(null);
    setOpen(date);
    if (details[date] && !details[date].error) return;
    setDetails((d) => ({ ...d, [date]: { loading: true, rows: [] } }));
    try {
      const j = await api.get<DailyResponse>(`/api/warehouse/daily?date=${encodeURIComponent(date)}`);
      setDetails((d) => ({ ...d, [date]: { loading: false, rows: j.rows || [] } }));
    } catch (e) {
      setDetails((d) => ({ ...d, [date]: { loading: false, rows: [], error: errorMessage(e) } }));
    }
  }

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!rows) return [];
    if (!k) return rows;
    return rows.filter((x) => `${x.work_date} ${fmtDateKey(x.work_date)} ${x.created_by}`.toLowerCase().includes(k));
  }, [rows, q]);

  return (
    <Card>
      <CardHeader
        icon={CalendarCheck2}
        title="Lịch sử các lần chốt ngày"
        description="Mỗi ngày hiển thị bản chốt mới nhất. Bấm vào một dòng để xem số liệu theo đơn hàng."
        actions={
          <>
            <SearchInput placeholder="Tìm theo ngày / người chốt" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
            <Button variant="secondary" size="icon" icon={RefreshCw} aria-label="Tải lại" onClick={refresh} />
          </>
        }
      />
      {!rows ? (
        error ? (
          <p className="px-5 py-8 text-center text-sm text-danger-600">{error}</p>
        ) : (
          <Spinner />
        )
      ) : !filtered.length ? (
        <EmptyState icon={CalendarCheck2} title={rows.length ? "Không có bản chốt phù hợp." : "Chưa có bản chốt."} />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th className="w-8" />
              <Th>Ngày</Th>
              <Th>Lần chốt</Th>
              <Th>Người chốt</Th>
              <Th>Thời gian</Th>
              <Th align="right">Thao tác</Th>
            </tr>
          </THead>
          <tbody>
            {filtered.map((x) => {
              const isOpen = open === x.work_date;
              const d = details[x.work_date];
              return (
                <Fragment key={`${x.work_date}-${x.version}`}>
                  <Tr onClick={() => toggle(x.work_date)} className={cn(isOpen && "bg-surface-2")}>
                    <Td>
                      <ChevronDown size={16} className={cn("text-subtle transition-transform", isOpen && "rotate-180")} />
                    </Td>
                    <Td className="font-semibold">{fmtDateKey(x.work_date)}</Td>
                    <Td>
                      <Badge tone="brand">Lần {x.version}</Badge>
                    </Td>
                    <Td>{x.created_by || "—"}</Td>
                    <Td className="whitespace-nowrap text-muted">{fmtDateTime(x.created_at)}</Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={ExternalLink}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDate(x.work_date);
                        }}
                      >
                        Mở ngày
                      </Button>
                    </Td>
                  </Tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={6} className="border-b border-line bg-surface-2 px-3 py-3 sm:px-5">
                        {!d || d.loading ? (
                          <Spinner className="py-4" />
                        ) : d.error ? (
                          <p className="py-2 text-sm text-danger-600">{d.error}</p>
                        ) : !d.rows.length ? (
                          <p className="py-2 text-sm text-muted">Bản chốt không có đơn hàng.</p>
                        ) : (
                          <div className="overflow-hidden rounded-lg border border-line bg-surface">
                            <Table>
                              <THead>
                                <tr>
                                  <Th>Đơn hàng</Th>
                                  <Th align="right">Sản xuất</Th>
                                  <Th align="right">Sang bao</Th>
                                  <Th align="right">Lũy kế</Th>
                                  <Th align="right">Còn lại</Th>
                                </tr>
                              </THead>
                              <tbody>
                                {d.rows.map((r) => (
                                  <Tr key={r.order_key}>
                                    <Td className="font-medium">{r.order_number}</Td>
                                    <Td align="right">{fmtNumber(num(r.produced_today))} t</Td>
                                    <Td align="right">{fmtNumber(num(r.repack_today))} t</Td>
                                    <Td align="right">{fmtNumber(num(r.produced_cumulative))} t</Td>
                                    <Td align="right">{fmtNumber(num(r.remaining))} t</Td>
                                  </Tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
