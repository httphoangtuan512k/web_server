"use client";
/**
 * File này: thẻ 1 máy nghiền – tiêu đề, trạng thái chạy, đơn đang chạy, sơ đồ SCADA, dòng thông báo PLC.
 * Dùng ở: trang Xưởng vận hành (mỗi máy một thẻ).
 */

import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import type { MillConfig } from "../_shared/plc";
import { ScadaDiagram } from "./scada-diagram";
import type { ScadaView } from "./scada";
import { remainingOf, type Order, type PlcStateKey } from "./types";

/** Tiêu đề thẻ máy đúng như trang cũ. */
const HEADINGS: Record<string, string> = {
  may1: "Xưởng vận hành – Máy nghiền SCLM-1100",
  may2: "Xưởng vận hành – Máy nghiền 2 SCLM-1100",
};

/** Viên trạng thái máy (.scada-state cũ): xanh lá khi đang nghiền, xám khi dừng / mất kết nối. */
const RUN_BADGE = {
  running: { cls: "bg-[#dcfce7] text-[#15803d]", text: "● Đang nghiền" },
  stopped: { cls: "bg-[#e5e7eb] text-[#64748b]", text: "● Đang dừng" },
  offline: { cls: "bg-[#e5e7eb] text-[#64748b]", text: "● Mất kết nối" },
  unknown: { cls: "bg-[#e5e7eb] text-[#64748b]", text: "● Đang chờ dữ liệu" },
} as const;

/** Thẻ 1 máy nghiền: tiêu đề + trạng thái, sơ đồ SCADA ảnh gốc với số liệu đè lên, dòng chú thích PLC. */
export function MillCard({
  cfg,
  view,
  orders,
  canEdit,
  onSave,
}: {
  cfg: MillConfig;
  view: ScadaView;
  /** Đơn đang chạy được gán cho máy này (theo tên máy). */
  orders: Order[];
  canEdit: boolean;
  onSave: (key: PlcStateKey, raw: string) => Promise<boolean>;
}) {
  // Chọn viên trạng thái và tiêu đề cho máy.
  const badge = RUN_BADGE[view.run];
  const heading = HEADINGS[cfg.machine] ?? `Xưởng vận hành – ${cfg.title} ${cfg.model}`;

  return (
    // Khung thẻ; viền xanh mờ khi máy đang nghiền.
    <section
      className={cn(
        "min-w-0 rounded-xl border border-[#dbe3ed] bg-white p-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-shadow sm:p-2.5",
        view.run === "running" && "ring-1 ring-[#16a34a]/25",
      )}
    >
      {/* Hàng tiêu đề + viên trạng thái */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 px-1 pt-0.5 sm:mb-2.5">
        <h2 className="min-w-0 flex-[1_1_180px] text-[15px] leading-tight font-bold text-[#1e3a8a] sm:text-lg">{heading}</h2>
        <span className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] font-bold whitespace-nowrap sm:px-[11px] sm:py-1.5 sm:text-sm", badge.cls)}>{badge.text}</span>
      </div>

      {/* Danh sách đơn đang chạy trên máy này: số đơn · còn bao nhiêu tấn */}
      {orders.length ? (
        <p className="mb-1.5 flex flex-wrap gap-1.5 px-1 text-xs text-[#475569]">
          <span className="text-[#64748b]">Đơn đang chạy:</span>
          {orders.map((o) => (
            <span key={o.id} className="num rounded-md bg-[#fef9c3] px-1.5 py-0.5 ring-1 ring-[#fde68a]">
              <b className="text-[#0f172a]">{o.orderNumber}</b> · còn <b className="text-[#dc2626]">{fmtNumber(remainingOf(o))}</b> t
            </span>
          ))}
        </p>
      ) : null}

      {/* Sơ đồ SCADA có số liệu đè lên ảnh */}
      <ScadaDiagram machine={cfg.machine} view={view} canEdit={canEdit} onSave={onSave} />

      {/* Dòng thông báo PLC (đỏ khi lỗi) */}
      <p
        className={cn(
          "num mt-1 px-1 text-[10px] leading-snug break-words sm:mt-2 sm:text-xs",
          view.tone === "danger" ? "text-[#dc2626]" : "text-[#64748b]",
        )}
      >
        {view.message}
      </p>
    </section>
  );
}
