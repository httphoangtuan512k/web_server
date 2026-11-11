"use client";
/**
 * File này: danh sách các ngày đã chốt; bấm một dòng để xem số liệu từng đơn của bản chốt.
 * Dùng ở: tab "Tổng hợp cuối ngày" khi bấm nút "Lịch sử chốt ngày".
 */

import { ChevronDown, RefreshCw } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Spinner } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { KBtn, KCard, KEmptyRow, KPill, KTable, kInput, kTd, kTh, kTr } from "./kho-ui";
import { fmtDateKey, num, type DailyResponse, type DailyRow, type SnapshotRow } from "./types";

// Chi tiết một ngày: đang tải?, các dòng, lỗi.
type Detail = { loading: boolean; rows: DailyRow[]; error?: string };

// Khối lịch sử chốt ngày. onOpenDate = mở ngày đó trong tab tổng hợp.
export function ClosingsTab({ onOpenDate }: { onOpenDate: (date: string) => void }) {
  const toast = useToast();
  // Danh sách bản chốt (null = đang tải), lỗi, chữ tìm.
  const [rows, setRows] = useState<SnapshotRow[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  // Ngày đang mở chi tiết, và chi tiết đã tải của từng ngày.
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});

  // Gọi API lấy danh sách bản chốt.
  const fetchRows = useCallback(() => api.get<{ rows: SnapshotRow[] }>("/api/warehouse/snapshots"), []);

  // Lần đầu hiện: tải danh sách.
  useEffect(() => {
    let alive = true;
    fetchRows()
      .then((j) => alive && setRows(j.rows || []))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [fetchRows]);

  // Nút ⟳: tải lại danh sách, xóa chi tiết cũ.
  async function refresh() {
    try {
      setRows((await fetchRows()).rows || []);
      setDetails({});
      setError("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  // Bấm một dòng: mở/đóng; lần đầu mở thì tải chi tiết ngày đó.
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

  // Lọc theo ngày hoặc người chốt.
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!rows) return [];
    if (!k) return rows;
    return rows.filter((x) => `${x.work_date} ${fmtDateKey(x.work_date)} ${x.created_by}`.toLowerCase().includes(k));
  }, [rows, q]);

  // Kiểu ô cho bảng chi tiết bên trong.
  const subTh = "border-b border-[#e3eaf2] bg-[#f2f6fa] px-2.5 py-2 text-xs font-bold whitespace-nowrap text-[#294766]";
  const subTd = cn(kTd, "py-2 text-right font-semibold tabular-nums");

  return (
    <KCard
      title="Lịch sử các lần chốt ngày"
      description="Mỗi ngày hiển thị bản chốt mới nhất. Bấm vào một dòng để xem số liệu theo đơn hàng."
      actions={
        // Ô tìm kiếm + nút tải lại.
        <>
          <input
            type="search"
            placeholder="Tìm theo ngày / người chốt"
            aria-label="Tìm bản chốt"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={cn(kInput, "flex-1 sm:w-60 sm:flex-none")}
          />
          <KBtn variant="secondary" onClick={refresh} aria-label="Tải lại" title="Tải lại" className="px-3">
            <RefreshCw size={15} />
          </KBtn>
        </>
      }
    >
      <KTable minWidth={620}>
        <thead>
          <tr>
            {/* Cột mũi tên, 4 cột thông tin, cột thao tác. */}
            <th className={cn(kTh, "w-9")} />
            {["Ngày", "Lần chốt", "Người chốt", "Thời gian"].map((h) => (
              <th key={h} className={cn(kTh, "text-left")}>
                {h}
              </th>
            ))}
            <th className={cn(kTh, "text-right")}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {/* Đang tải/lỗi → thông báo; không có → câu trống; có → mỗi bản chốt một dòng. */}
          {!rows ? (
            <KEmptyRow colSpan={6}>{error ? <span className="text-[#c24141]">{error}</span> : "Đang tải..."}</KEmptyRow>
          ) : !filtered.length ? (
            <KEmptyRow colSpan={6}>{rows.length ? "Không có bản chốt phù hợp." : "Chưa có bản chốt."}</KEmptyRow>
          ) : (
            filtered.map((x) => {
              const isOpen = open === x.work_date;
              const d = details[x.work_date];
              return (
                <Fragment key={`${x.work_date}-${x.version}`}>
                  {/* Dòng bản chốt: bấm để mở/đóng chi tiết. */}
                  <tr onClick={() => toggle(x.work_date)} className={cn(kTr, "cursor-pointer", isOpen && "bg-[#f8fbfe]")}>
                    <td className={cn(kTd, "pr-0")}>
                      <ChevronDown size={16} className={cn("text-[#66758a] transition-transform", isOpen && "rotate-180")} />
                    </td>
                    <td className={cn(kTd, "font-bold whitespace-nowrap")}>{fmtDateKey(x.work_date)}</td>
                    <td className={kTd}>
                      <KPill tone="blue">Lần {x.version}</KPill>
                    </td>
                    <td className={kTd}>{x.created_by || "—"}</td>
                    <td className={cn(kTd, "whitespace-nowrap text-[#66758a]")}>{fmtDateTime(x.created_at)}</td>
                    {/* Nút "Mở ngày" (không làm mở/đóng dòng). */}
                    <td className={cn(kTd, "text-right")}>
                      <KBtn
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDate(x.work_date);
                        }}
                      >
                        Mở ngày
                      </KBtn>
                    </td>
                  </tr>
                  {/* Dòng chi tiết (khi mở): bảng sản xuất / sang bao / lũy kế / còn lại theo đơn. */}
                  {isOpen ? (
                    <tr>
                      <td colSpan={6} className="border-b border-[#edf1f5] bg-[#f6faff] px-3 py-3 sm:px-5">
                        {!d || d.loading ? (
                          <Spinner className="py-4" />
                        ) : d.error ? (
                          <p className="py-2 text-sm text-[#c24141]">{d.error}</p>
                        ) : !d.rows.length ? (
                          <p className="py-2 text-sm text-[#66758a]">Bản chốt không có đơn hàng.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-[#e0ebf7] bg-white">
                            <table className="w-full min-w-[480px] border-separate border-spacing-0">
                              <thead>
                                <tr>
                                  <th className={cn(subTh, "text-left")}>Đơn hàng</th>
                                  <th className={cn(subTh, "text-right")}>Sản xuất</th>
                                  <th className={cn(subTh, "text-right")}>Sang bao</th>
                                  <th className={cn(subTh, "text-right")}>Lũy kế</th>
                                  <th className={cn(subTh, "text-right")}>Còn lại</th>
                                </tr>
                              </thead>
                              <tbody>
                                {d.rows.map((r) => (
                                  <tr key={r.order_key} className={kTr}>
                                    <td className={cn(kTd, "py-2 font-bold")}>{r.order_number}</td>
                                    <td className={subTd}>{fmtNumber(num(r.produced_today), 2, "0")} tấn</td>
                                    <td className={subTd}>{fmtNumber(num(r.repack_today), 2, "0")} tấn</td>
                                    <td className={subTd}>{fmtNumber(num(r.produced_cumulative), 2, "0")} tấn</td>
                                    <td className={subTd}>{fmtNumber(num(r.remaining), 2, "0")} tấn</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </KTable>
    </KCard>
  );
}
