"use client";

import { useCallback, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MachineDialog, type MachineDialogKind } from "./machine-dialog";
import { SmallButton } from "./order-bits";
import type { OrderGroup, OrderPerms } from "./types";
import { fmtTons, toNum } from "./utils";

export type OrderActionKind = "view" | "edit" | "start" | "resume" | "pause" | "addMachine" | "complete" | "delete";

/** Chữ + màu nền đúng như nút `.small` trang cũ (kehoach.html). */
const DEFS: Record<OrderActionKind, { text: string; title: string; bg: string; dark?: boolean }> = {
  view: { text: "👁 Xem", title: "Xem chi tiết", bg: "#e2e8f0" },
  start: { text: "▶ Chạy", title: "Bắt đầu chạy", bg: "#2563eb", dark: true },
  resume: { text: "▶ Chạy tiếp", title: "Chạy tiếp", bg: "#10b981", dark: true },
  pause: { text: "⏸ Tạm dừng", title: "Tạm dừng", bg: "#d97706", dark: true },
  addMachine: { text: "▶ Chạy thêm máy", title: "Chạy thêm máy", bg: "#2563eb", dark: true },
  complete: { text: "✔ Xác nhận xong", title: "Xác nhận hoàn thành", bg: "#065f46", dark: true },
  edit: { text: "Sửa", title: "Sửa đơn", bg: "#0ea5e9", dark: true },
  delete: { text: "Xóa", title: "Xóa đơn", bg: "#ef4444", dark: true },
};

/** Các thao tác hợp lệ cho một đơn theo trạng thái + quyền (giống trang cũ, đúng thứ tự nút). */
export function availableActions(g: OrderGroup, perms: OrderPerms): OrderActionKind[] {
  const out: OrderActionKind[] = [];
  if (g.status === "new" && perms.operate) out.push("start");
  else if (g.status === "running" && perms.operate) {
    if (g.isPaused) out.push("resume");
    else out.push("pause", "addMachine");
  }
  if (g.status === "running" && perms.confirm) out.push("complete");
  if (perms.edit) out.push("edit");
  if (perms.remove) out.push("delete");
  return out;
}

/** Hàng nút thao tác kiểu trang cũ: `👁 Xem` (nếu `withView`) → chạy/dừng/xác nhận → `Sửa` → `Xóa`. */
export function OrderActionButtons({
  group,
  perms,
  onAction,
  pending,
  withView,
  className,
}: {
  group: OrderGroup;
  perms: OrderPerms;
  onAction: (kind: OrderActionKind, g: OrderGroup) => void;
  pending?: string | null;
  withView?: boolean;
  className?: string;
}) {
  const kinds = availableActions(group, perms);
  if (withView) kinds.unshift("view");
  if (!kinds.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)} onClick={(e) => e.stopPropagation()}>
      {kinds.map((k) => {
        const d = DEFS[k];
        return (
          <SmallButton
            key={k}
            bg={d.bg}
            dark={d.dark}
            loading={pending === `${k}:${group.id}`}
            title={d.title}
            onClick={() => onAction(k, group)}
          >
            {d.text}
          </SmallButton>
        );
      })}
    </div>
  );
}

/**
 * Thao tác vận hành: chạy / chạy tiếp / chạy thêm máy (hỏi tên máy), tạm dừng / xác nhận / xóa (hộp xác nhận).
 * Trả về `perform` + `dialog` (đặt dialog vào cây JSX).
 */
export function useOrderOperations({ reload, machineSuggestions }: { reload: () => Promise<void>; machineSuggestions: string[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [machine, setMachine] = useState<{ kind: MachineDialogKind; group: OrderGroup } | null>(null);

  const exec = useCallback(
    async (key: string, call: () => Promise<unknown>, success: string) => {
      setPending(key);
      try {
        await call();
        await reload();
        toast.success(success);
        return true;
      } catch (e) {
        toast.error(errorMessage(e));
        return false;
      } finally {
        setPending(null);
      }
    },
    [reload, toast],
  );

  /** Trả về true nếu thao tác đã thực hiện xong (để đóng modal chi tiết khi xóa…). */
  const perform = useCallback(
    async (kind: OrderActionKind, g: OrderGroup): Promise<boolean> => {
      const key = `${kind}:${g.id}`;
      switch (kind) {
        case "start":
        case "resume":
        case "addMachine":
          setMachine({ kind, group: g });
          return false;
        case "pause": {
          const ok = await confirm({
            title: "Tạm dừng đơn hàng này?",
            message: `Đơn ${g.orderNumber} – ${g.packagingCode || g.itemCode}. Có thể bấm "Chạy tiếp" để chạy lại.`,
            confirmText: "Tạm dừng",
          });
          if (!ok) return false;
          return exec(key, () => api.post(`/api/orders/${g.id}/operations/pause`, {}), "Đã tạm dừng đơn hàng.");
        }
        case "complete": {
          const qty = toNum(g.quantity);
          const produced = toNum(g.actualProduced);
          const ok = await confirm({
            title: "Xác nhận hoàn thành đơn hàng?",
            message: (
              <div className="space-y-2">
                <p>
                  Đơn <b className="text-fg">{g.orderNumber}</b> – sản lượng hiện tại{" "}
                  <b className="num text-fg">
                    {fmtTons(produced)}/{fmtTons(qty)} tấn
                  </b>
                  .
                </p>
                <p>Có thể xác nhận kể cả khi sản lượng chưa đủ. Tất cả máy của đơn sẽ chuyển sang Hoàn thành.</p>
              </div>
            ),
            confirmText: "Xác nhận hoàn thành",
          });
          if (!ok) return false;
          return exec(key, () => api.put(`/api/orders/${g.id}/operations/complete`, {}), "Đã xác nhận hoàn thành.");
        }
        case "delete": {
          const ok = await confirm({
            title: "Xóa đơn hàng?",
            message: `Bạn có chắc chắn muốn xóa đơn ${g.orderNumber}${g.rows.length > 1 ? ` (dòng máy ${g.machineName || "đại diện"})` : ""}? Thao tác này không thể hoàn tác.`,
            confirmText: "Xóa đơn",
            danger: true,
          });
          if (!ok) return false;
          return exec(key, () => api.delete(`/api/orders/${g.id}`), "Đã xóa đơn hàng thành công");
        }
        default:
          return false;
      }
    },
    [confirm, exec],
  );

  const submitMachine = useCallback(
    async (name: string) => {
      if (!machine) return false;
      const { kind, group } = machine;
      const body = { machineName: name };
      const ok =
        kind === "start"
          ? await exec(`start:${group.id}`, () => api.post(`/api/orders/${group.id}/operations/start`, body), "Đã ghi nhận bắt đầu chạy.")
          : kind === "resume"
            ? await exec(`resume:${group.id}`, () => api.post(`/api/orders/${group.id}/operations/resume`, body), "Đã tiếp tục chạy máy.")
            : await exec(`addMachine:${group.id}`, () => api.post(`/api/orders/${group.id}/split`, body), "Đã ghi nhận sự kiện Chạy thêm máy.");
      if (ok) setMachine(null);
      return ok;
    },
    [machine, exec],
  );

  const dialog = machine ? (
    <MachineDialog
      kind={machine.kind}
      group={machine.group}
      suggestions={machineSuggestions}
      busy={!!pending}
      onClose={() => setMachine(null)}
      onSubmit={submitMachine}
    />
  ) : null;

  return { perform, pending, dialog };
}
