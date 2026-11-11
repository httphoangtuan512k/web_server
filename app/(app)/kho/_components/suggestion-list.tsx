"use client";
/**
 * File này: bảng "đơn hàng được gợi ý trong ngày" với nút "＋ Chọn đơn" / "Đã chọn".
 * Dùng ở: khối đầu tiên của tab "Tổng hợp cuối ngày" (trang /kho).
 */

import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import { KBtn, KEmptyRow, KPill, KTable, kTd, kTh, kTr } from "./kho-ui";
import type { DailySuggestion } from "./types";

// Chữ và màu nhãn cho từng trạng thái đơn.
const STATUS: Record<string, { label: string; tone: "green" | "blue" | "amber" | "red" }> = {
  running: { label: "Đang chạy", tone: "green" },
  completed: { label: "Hoàn thành", tone: "blue" },
  new: { label: "Mới", tone: "blue" },
  paused: { label: "Tạm dừng", tone: "amber" },
};

// Nhãn trạng thái đơn (Đang chạy, Tạm dừng…); trống thì hiện "—".
export function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-[#66758a]">—</span>;
  const s = STATUS[status];
  return <KPill tone={s?.tone || "blue"}>{s?.label || status}</KPill>;
}

/** Nút "＋ Chọn đơn" (xanh lá) / "Đã chọn" (xám) như trang cũ. */
function SelectButton({ active, disabled, onClick }: { active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <KBtn
      variant={active ? "secondary" : "green"}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className="min-h-9 min-w-[94px] px-2.5 text-xs disabled:border-[#dce5ef] disabled:bg-[#edf2f7] disabled:text-[#74869b] disabled:opacity-100"
    >
      {active ? "Đã chọn" : "＋ Chọn đơn"}
    </KBtn>
  );
}

// Danh sách máy dạng chữ, hoặc "Chưa xác định máy".
const machinesText = (x: DailySuggestion) => (x.machines.length ? x.machines.join(", ") : "Chưa xác định máy");

// Bảng đơn gợi ý. selected = các đơn đã chọn; onToggle = bấm chọn/bỏ chọn.
export function SuggestionList({
  suggestions,
  selected,
  onToggle,
  disabled,
  status,
}: {
  suggestions: DailySuggestion[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  disabled?: boolean;
  /** Đang tải / lỗi – hiện thay cho các dòng. */
  status?: string | null;
}) {
  // Câu thay cho bảng khi đang tải / lỗi / không có đơn.
  const empty = status || (!suggestions.length ? "Ngày này không có đơn phát sinh thao tác chạy máy." : null);
  return (
    <>
      {/* Máy tính / máy tính bảng: bảng cột cố định như bản gốc */}
      <div className="hidden md:block">
        <KTable minWidth={820} fixed>
          {/* Độ rộng 7 cột. */}
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "23%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "11%" }} />
          </colgroup>
          <thead>
            <tr>
              {/* Tiêu đề 7 cột. */}
              {["Đơn hàng", "Bao bì", "Cỡ hạt", "Tổng đơn (tấn)", "Máy vận hành trong ngày", "Trạng thái", "Chọn"].map((h) => (
                <th key={h} className={cn(kTh, "text-center whitespace-normal")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <KEmptyRow colSpan={7}>{empty}</KEmptyRow>
            ) : (
              // Mỗi đơn một dòng; đơn đã chọn có nền xanh nhạt.
              suggestions.map((x) => {
                const active = selected.has(x.order_key);
                return (
                  <tr key={x.order_key} className={cn(kTr, active && "bg-[#f3faf6]")}>
                    <td className={kTd}>
                      <b>{x.order_number}</b>
                    </td>
                    <td className={kTd}>{x.packaging_code || "—"}</td>
                    <td className={kTd}>{x.grain_size || "—"}</td>
                    <td className={cn(kTd, "text-center font-semibold tabular-nums")}>{fmtNumber(x.order_total)}</td>
                    <td className={cn(kTd, "text-center", !x.machines.length && "text-[#66758a]")}>{machinesText(x)}</td>
                    <td className={cn(kTd, "text-center")}>
                      <StatusBadge status={x.status} />
                    </td>
                    <td className={cn(kTd, "text-center")}>
                      <SelectButton active={active} disabled={disabled} onClick={() => onToggle(x.order_key)} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </KTable>
      </div>

      {/* Điện thoại: dạng thẻ */}
      <div className="md:hidden">
        {empty ? (
          <p className="rounded-xl border border-[#dce5ef] px-4 py-7 text-center text-[13px] text-[#66758a]">{empty}</p>
        ) : (
          <ul className="space-y-2.5">
            {/* Mỗi đơn một thẻ: số đơn + trạng thái, bao bì · cỡ hạt · tổng, máy, nút chọn. */}
            {suggestions.map((x) => {
              const active = selected.has(x.order_key);
              return (
                <li key={x.order_key} className={cn("rounded-xl border p-3", active ? "border-[#bfe3cf] bg-[#f3faf6]" : "border-[#dce5ef] bg-white")}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-[15px] text-[#12345a]">{x.order_number}</b>
                        <StatusBadge status={x.status} />
                      </div>
                      <p className="mt-1 text-[13px] text-[#40546b]">
                        {[x.packaging_code, x.grain_size].filter(Boolean).join(" · ") || "—"} · <b className="tabular-nums">{fmtNumber(x.order_total)}</b> tấn
                      </p>
                      <p className="mt-0.5 text-xs text-[#66758a]">{machinesText(x)}</p>
                    </div>
                    <SelectButton active={active} disabled={disabled} onClick={() => onToggle(x.order_key)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
