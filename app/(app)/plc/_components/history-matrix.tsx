"use client";
/**
 * File này: bảng ma trận lịch sử PLC – hàng là tag, cột là thời điểm; cột Máy, Tên tag và cột ghim đứng yên khi cuộn ngang.
 * Dùng ở: phần "Lịch sử PLC" trang /plc.
 */

import { memo, useMemo } from "react";
import { cn } from "@/lib/cn";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { formatPlcValue, PLC_MACHINES } from "../../van-hanh/_shared/plc";
import type { HistoryMachineFilter, PlcHistoryRow, PlcValue } from "./types";

// Lấy giá trị 1 tag của 1 máy tại 1 thời điểm (undefined nếu không có).
const cellValue = (row: PlcHistoryRow, machine: string, tag: string): PlcValue | undefined => {
  const m = row.payload?.machines?.[machine];
  return m && Object.prototype.hasOwnProperty.call(m, tag) ? m[tag] : undefined;
};

/**
 * Ma trận lịch sử: mỗi hàng là 1 tag của 1 máy, mỗi cột là 1 thời điểm lưu.
 * Hai cột Máy + Tên tag cố định; các cột ghim nằm ngay cạnh tên tag.
 */
export const HistoryMatrix = memo(function HistoryMatrix({
  rows,
  pins,
  machine,
  newestFirst,
}: {
  rows: PlcHistoryRow[];
  pins: PlcHistoryRow[];
  machine: HistoryMachineFilter;
  newestFirst: boolean;
}) {
  // Sắp xếp thời điểm cũ → mới (đảo lại nếu chọn "Mới nhất trước").
  const snapshots = useMemo(() => {
    const s = rows.slice().sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at));
    return newestFirst ? s.reverse() : s;
  }, [rows, newestFirst]);

  // Gom tag theo máy (theo bộ lọc máy) từ mọi thời điểm và mốc ghim.
  const groups = useMemo(() => {
    const visible = machine === "all" ? PLC_MACHINES : PLC_MACHINES.filter((m) => m.id === machine);
    return visible.map(({ id, label }) => {
      const tags = new Set<string>();
      for (const r of [...pins, ...snapshots]) Object.keys(r.payload?.machines?.[id] ?? {}).forEach((t) => tags.add(t));
      return { id, label, tags: [...tags] };
    });
  }, [machine, pins, snapshots]);

  // Số dòng tag và tên bộ lọc để hiện ở dòng tóm tắt.
  const tagRows = groups.reduce((n, g) => n + g.tags.length, 0);
  const machineLabel = machine === "all" ? "Tất cả máy" : (PLC_MACHINES.find((m) => m.id === machine)?.label ?? machine);

  // Kiểu cột dính bên trái (Máy, Tên tag) và ô bảng chung.
  const stickyMachine = "sticky left-0 w-[52px] min-w-[52px] max-w-[52px] whitespace-normal sm:w-[66px] sm:min-w-[66px] sm:max-w-[66px]";
  const stickyTag = "sticky left-[52px] w-[145px] min-w-[145px] max-w-[145px] whitespace-normal [overflow-wrap:anywhere] sm:left-[66px] sm:w-[210px] sm:min-w-[210px] sm:max-w-[210px] sm:whitespace-nowrap";
  const cell = "border-r border-b border-[#e2e8f0] px-[7px] py-2 text-center sm:px-2.5";

  return (
    <>
      {/* Dòng tóm tắt bộ lọc, số mốc ghim, số thời điểm */}
      <p className="mt-2 mb-3 text-xs text-[#64748b]">
        Bộ lọc: <b className="text-[#475569]">{machineLabel}</b> · <span className="num">{pins.length}</span> mốc đã ghim · Có <span className="num">{snapshots.length}</span> thời điểm ·{" "}
        <span className="num">{tagRows}</span> dòng tag. Kéo ngang để xem các mốc thời gian khác; các cột ghim nằm ngay cạnh tên tag.
      </p>
      {/* Khung bảng cuộn được cả ngang lẫn dọc */}
      <div className="relative max-h-[68vh] w-full overflow-auto overscroll-x-contain rounded-lg border border-[#dbe3ed] bg-white sm:max-h-[72vh] sm:rounded-[9px]">
        <table className="min-w-max border-separate border-spacing-0 text-[11px] whitespace-nowrap text-[#172033] sm:text-xs">
          <thead>
            <tr>
              {/* Hàng tiêu đề: Máy, Tên tag, các cột ghim (vàng), các thời điểm */}
              <th className={cn(cell, stickyMachine, "top-0 z-[7] h-11 bg-[#dbeafe] font-bold text-[#1e3a8a]")}>Máy</th>
              <th className={cn(cell, stickyTag, "top-0 z-[7] h-11 bg-[#dbeafe] text-left font-bold text-[#1e3a8a]")}>Tên tag</th>
              {pins.map((r, i) => (
                <th key={`pin-${r.id}`} title={`Mốc đã ghim ${fmtDateTime(r.received_at)}`} className={cn(cell, "sticky top-0 z-[5] h-11 min-w-[86px] bg-[#fef3c7] font-bold text-[#854d0e] sm:min-w-[96px]")}>
                  Ghim {i + 1}
                  <div className="num text-[10px] font-normal">{fmtTime(r.received_at)}</div>
                </th>
              ))}
              {snapshots.map((r) => (
                <th key={r.id} title={fmtDateTime(r.received_at)} className={cn(cell, "sticky top-0 z-[5] h-11 min-w-[86px] bg-[#eaf0f8] font-bold text-[#1e3a8a] sm:min-w-[96px]")}>
                  <span className="num">{fmtTime(r.received_at)}</span>
                  <div className="num text-[10px] font-normal text-[#64748b]">{fmtDate(r.received_at)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Mỗi máy một nhóm dòng; máy chưa có tag thì hiện 1 dòng "Chưa có tag" */}
            {groups.map((g) =>
              g.tags.length ? (
                g.tags.map((tag, idx) => (
                  <tr key={`${g.id}-${tag}`} className="group">
                    {/* Ô tên máy gộp dọc cho cả nhóm (chỉ ở dòng đầu) */}
                    {idx === 0 ? (
                      <th rowSpan={g.tags.length} className={cn(cell, stickyMachine, "z-[4] border-t-[5px] border-t-[#cbd5e1] bg-[#f1f5f9] align-top text-[10px] font-bold text-[#1e3a8a] sm:text-xs")}>
                        {g.label}
                      </th>
                    ) : null}
                    {/* Ô tên tag */}
                    <th
                      title={tag}
                      className={cn(cell, stickyTag, "z-[4] overflow-hidden bg-[#f8fafc] text-left font-semibold text-ellipsis group-hover:bg-[#eff6ff]", idx === 0 && "border-t-[5px] border-t-[#cbd5e1]")}
                    >
                      {tag}
                    </th>
                    {/* Giá trị tại các mốc ghim (nền vàng) */}
                    {pins.map((r) => {
                      const v = cellValue(r, g.id, tag);
                      return (
                        <td key={`pin-${r.id}`} className={cn(cell, "num bg-[#fff7d6] font-bold text-[#854d0e]", v === undefined && "font-normal text-[#94a3b8]", idx === 0 && "border-t-[5px] border-t-[#cbd5e1]")}>
                          {v === undefined ? "—" : formatPlcValue(v)}
                        </td>
                      );
                    })}
                    {/* Giá trị tại từng thời điểm */}
                    {snapshots.map((r) => {
                      const v = cellValue(r, g.id, tag);
                      return (
                        <td key={r.id} className={cn(cell, "num group-hover:bg-[#f8fbff]", v === undefined ? "text-[#94a3b8]" : "font-bold", idx === 0 && "border-t-[5px] border-t-[#cbd5e1]")}>
                          {v === undefined ? "—" : formatPlcValue(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr key={g.id}>
                  <th className={cn(cell, stickyMachine, "z-[4] bg-[#f1f5f9] font-bold text-[#1e3a8a]")}>{g.label}</th>
                  <th className={cn(cell, stickyTag, "z-[4] bg-[#f8fafc] text-left font-semibold")}>Chưa có tag</th>
                  {pins.map((r) => (
                    <td key={`pin-${r.id}`} className={cn(cell, "bg-[#fff7d6] text-[#94a3b8]")}>
                      —
                    </td>
                  ))}
                  {snapshots.map((r) => (
                    <td key={r.id} className={cn(cell, "text-[#94a3b8]")}>
                      —
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
});
