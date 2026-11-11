"use client";
/**
 * File này: dòng thời gian lịch sử vận hành của đơn (Tạo đơn → Chạy → Tạm dừng → Xác nhận…).
 * Dùng ở: hộp chi tiết đơn trên trang Kế hoạch.
 */

import { CheckCheck, FilePlus2, Pause, Play, PlayCircle, PlusCircle, Radio, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/card";
import type { OperationEvent, Order } from "./types";
import { fmtTons, toNum } from "./utils";

// Icon và màu cho từng loại sự kiện (Chạy, Tạm dừng, Xác nhận…).
const EVENT_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  "Bắt đầu chạy": { icon: Play, tone: "bg-brand-50 text-brand-600" },
  "Chạy tiếp": { icon: PlayCircle, tone: "bg-brand-50 text-brand-600" },
  "Tạm dừng": { icon: Pause, tone: "bg-warning-50 text-warning-600" },
  "Chạy thêm máy": { icon: PlusCircle, tone: "bg-accent-50 text-accent-600" },
  "Xác nhận hoàn thành": { icon: CheckCheck, tone: "bg-success-50 text-success-600" },
};

// Trạng thái tải: đang tải / thành công (có danh sách) / lỗi.
type State = { status: "loading" } | { status: "ok"; events: OperationEvent[] } | { status: "error"; message: string };

/** Lịch sử vận hành & xác nhận của cả nhóm đơn: GET /api/orders/:id/operations. */
export function OperationTimeline({ order, version }: { order: Order; version: number }) {
  const [state, setState] = useState<State>({ status: "loading" });

  // Tải nhật ký khi đổi đơn hoặc khi `version` tăng (sau mỗi thao tác).
  useEffect(() => {
    let alive = true;
    api
      .get<OperationEvent[]>(`/api/orders/${encodeURIComponent(order.id)}/operations`)
      .then((events) => alive && setState({ status: "ok", events: Array.isArray(events) ? events : [] }))
      .catch((e) => alive && setState({ status: "error", message: errorMessage(e) }));
    return () => {
      alive = false;
    };
  }, [order.id, version]);

  // Đang tải: 2 khối xám nhấp nháy.
  if (state.status === "loading")
    return (
      <div className="space-y-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  // Lỗi: dòng chữ đỏ.
  if (state.status === "error") return <p className="text-sm text-danger-600">Không tải được nhật ký: {state.message}</p>;

  // Ghép mục "Tạo đơn" đầu tiên + các sự kiện, mỗi mục có các dòng chi tiết.
  const items: Array<{ key: string; icon: LucideIcon; tone: string; title: string; time: string; lines: string[] }> = [
    {
      key: "created",
      icon: FilePlus2,
      tone: "bg-surface-3 text-muted",
      title: "Tạo đơn",
      time: order.createdAt,
      lines: [`Người tạo: ${order.creatorName || "—"}`],
    },
    ...state.events.map((e) => {
      const st = EVENT_STYLE[e.event_type] ?? { icon: Radio, tone: "bg-info-50 text-info-600" };
      const lines = [`Người thực hiện: ${e.user_name || "—"}`];
      if (e.machine_name) lines.push(`Máy: ${e.machine_name}`);
      if (toNum(e.machine_count)) lines.push(`Số máy đã chạy: ${e.machine_count}`);
      if (toNum(e.actual_tons)) lines.push(`Sản lượng thực tế: ${fmtTons(e.actual_tons)} tấn`);
      return { key: `e${e.id}`, icon: st.icon, tone: st.tone, title: e.event_type, time: e.created_at, lines };
    }),
  ];

  return (
    // Danh sách dọc dạng dòng thời gian.
    <ol className="relative space-y-3">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          // Một mục: chấm tròn icon màu + tiêu đề, giờ, chi tiết.
          <li key={it.key} className="relative flex gap-3">
            {/* Đường kẻ dọc nối tới mục kế tiếp. */}
            {i < items.length - 1 ? <span className="absolute top-8 bottom-[-12px] left-[15px] w-px bg-line" aria-hidden /> : null}
            <span className={cn("relative z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-surface", it.tone)}>
              <Icon size={15} />
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <p className="text-sm font-medium text-fg">
                {it.title}
                <span className="ml-2 text-xs font-normal text-muted">{fmtDateTime(it.time)}</span>
              </p>
              <p className="mt-0.5 text-[13px] text-muted">{it.lines.join(" · ")}</p>
            </div>
          </li>
        );
      })}
      {/* Chưa có sự kiện nào ngoài "Tạo đơn". */}
      {state.events.length === 0 ? <li className="pl-11 text-[13px] text-subtle">Chưa có hoạt động chạy/dừng.</li> : null}
    </ol>
  );
}
