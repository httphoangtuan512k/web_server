"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/cn";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { formatPlcValue, PLC_MACHINES } from "../../van-hanh/_shared/plc";
import type { HistoryMachineFilter, PlcHistoryRow, PlcValue } from "./types";

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
  const snapshots = useMemo(() => {
    const s = rows.slice().sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at));
    return newestFirst ? s.reverse() : s;
  }, [rows, newestFirst]);

  const groups = useMemo(() => {
    const visible = machine === "all" ? PLC_MACHINES : PLC_MACHINES.filter((m) => m.id === machine);
    return visible.map(({ id, label }) => {
      const tags = new Set<string>();
      for (const r of [...pins, ...snapshots]) Object.keys(r.payload?.machines?.[id] ?? {}).forEach((t) => tags.add(t));
      return { id, label, tags: [...tags] };
    });
  }, [machine, pins, snapshots]);

  const tagRows = groups.reduce((n, g) => n + g.tags.length, 0);
  const machineLabel = machine === "all" ? "Tất cả máy" : (PLC_MACHINES.find((m) => m.id === machine)?.label ?? machine);

  const stickyMachine = "sticky left-0 w-14 min-w-14 max-w-14 sm:w-[76px] sm:min-w-[76px] sm:max-w-[76px]";
  const stickyTag = "sticky left-14 w-[150px] min-w-[150px] max-w-[150px] sm:left-[76px] sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px]";
  const cell = "border-r border-b border-line px-2.5 py-2 text-center";

  return (
    <>
      <p className="mb-3 text-xs text-muted">
        Bộ lọc: <b className="text-fg">{machineLabel}</b> · <span className="num">{pins.length}</span> mốc đã ghim · Có <span className="num">{snapshots.length}</span> thời điểm ·{" "}
        <span className="num">{tagRows}</span> dòng tag. Kéo ngang để xem các mốc thời gian khác; các cột ghim nằm ngay cạnh tên tag.
      </p>
      <div className="relative max-h-[72vh] w-full overflow-auto overscroll-x-contain rounded-xl border border-line bg-surface">
        <table className="min-w-max border-separate border-spacing-0 text-xs whitespace-nowrap">
          <thead>
            <tr>
              <th className={cn(cell, stickyMachine, "top-0 z-[7] bg-surface-3 font-semibold text-fg")}>Máy</th>
              <th className={cn(cell, stickyTag, "top-0 z-[7] bg-surface-3 text-left font-semibold text-fg")}>Tên tag</th>
              {pins.map((r, i) => (
                <th key={`pin-${r.id}`} title={`Mốc đã ghim ${fmtDateTime(r.received_at)}`} className={cn(cell, "sticky top-0 z-[5] min-w-[92px] bg-warning-50 font-semibold text-warning-600")}>
                  Ghim {i + 1}
                  <div className="num text-[10px] font-normal">{fmtTime(r.received_at)}</div>
                </th>
              ))}
              {snapshots.map((r) => (
                <th key={r.id} title={fmtDateTime(r.received_at)} className={cn(cell, "sticky top-0 z-[5] min-w-[92px] bg-surface-2 font-semibold text-fg")}>
                  <span className="num">{fmtTime(r.received_at)}</span>
                  <div className="num text-[10px] font-normal text-muted">{fmtDate(r.received_at)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) =>
              g.tags.length ? (
                g.tags.map((tag, idx) => (
                  <tr key={`${g.id}-${tag}`} className="group">
                    {idx === 0 ? (
                      <th rowSpan={g.tags.length} className={cn(cell, stickyMachine, "z-[4] border-t-4 border-t-line-strong bg-surface-3 align-top font-semibold whitespace-normal text-fg")}>
                        {g.label}
                      </th>
                    ) : null}
                    <th
                      title={tag}
                      className={cn(cell, stickyTag, "z-[4] overflow-hidden bg-surface-2 text-left font-medium text-ellipsis text-fg group-hover:bg-brand-50", idx === 0 && "border-t-4 border-t-line-strong")}
                    >
                      {tag}
                    </th>
                    {pins.map((r) => {
                      const v = cellValue(r, g.id, tag);
                      return (
                        <td key={`pin-${r.id}`} className={cn(cell, "num bg-warning-50 font-semibold", v === undefined ? "text-subtle" : "text-fg", idx === 0 && "border-t-4 border-t-line-strong")}>
                          {v === undefined ? "—" : formatPlcValue(v)}
                        </td>
                      );
                    })}
                    {snapshots.map((r) => {
                      const v = cellValue(r, g.id, tag);
                      return (
                        <td key={r.id} className={cn(cell, "num group-hover:bg-surface-2", v === undefined ? "text-subtle" : "font-semibold text-fg", idx === 0 && "border-t-4 border-t-line-strong")}>
                          {v === undefined ? "—" : formatPlcValue(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr key={g.id}>
                  <th className={cn(cell, stickyMachine, "z-[4] bg-surface-3 font-semibold text-fg")}>{g.label}</th>
                  <th className={cn(cell, stickyTag, "z-[4] bg-surface-2 text-left font-normal text-muted")}>Chưa có tag</th>
                  {pins.map((r) => (
                    <td key={`pin-${r.id}`} className={cn(cell, "bg-warning-50 text-subtle")}>
                      —
                    </td>
                  ))}
                  {snapshots.map((r) => (
                    <td key={r.id} className={cn(cell, "text-subtle")}>
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
