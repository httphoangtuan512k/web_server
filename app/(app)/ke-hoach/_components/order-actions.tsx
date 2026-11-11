"use client";

import { CheckCheck, Eye, Pause, Pencil, Play, PlayCircle, PlusCircle, Trash2, type LucideIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MachineDialog, type MachineDialogKind } from "./machine-dialog";
import type { OrderGroup, OrderPerms } from "./types";
import { fmtTons, toNum } from "./utils";

export type OrderActionKind = "view" | "edit" | "start" | "resume" | "pause" | "addMachine" | "complete" | "delete";

interface ActionDef {
  label: string;
  short?: string;
  icon: LucideIcon;
  variant: "primary" | "secondary" | "ghost" | "danger" | "accent" | "success";
}

const DEFS: Record<OrderActionKind, ActionDef> = {
  view: { label: "Xem chi tiết", short: "Xem", icon: Eye, variant: "secondary" },
  start: { label: "Chạy", icon: Play, variant: "primary" },
  resume: { label: "Chạy tiếp", icon: PlayCircle, variant: "success" },
  pause: { label: "Tạm dừng", icon: Pause, variant: "accent" },
  addMachine: { label: "Chạy thêm máy", short: "Thêm máy", icon: PlusCircle, variant: "secondary" },
  complete: { label: "Xác nhận hoàn thành", short: "Xác nhận xong", icon: CheckCheck, variant: "success" },
  edit: { label: "Sửa đơn", short: "Sửa", icon: Pencil, variant: "ghost" },
  delete: { label: "Xóa đơn", short: "Xóa", icon: Trash2, variant: "ghost" },
};

/** Các thao tác hợp lệ cho một đơn theo trạng thái + quyền (giống trang cũ). */
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

/** Hàng nút thao tác. `compact`: nút Sửa/Xóa chỉ hiện icon (bảng desktop). */
export function OrderActionButtons({
  group,
  perms,
  onAction,
  pending,
  withView,
  compact,
  hideEmpty,
  className,
}: {
  group: OrderGroup;
  perms: OrderPerms;
  onAction: (kind: OrderActionKind, g: OrderGroup) => void;
  pending?: string | null;
  withView?: boolean;
  compact?: boolean;
  /** Không hiện "—" khi không có thao tác nào. */
  hideEmpty?: boolean;
  className?: string;
}) {
  const kinds = availableActions(group, perms);
  if (withView) kinds.unshift("view");
  if (!kinds.length) return hideEmpty ? null : <span className="text-xs text-subtle">—</span>;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} onClick={(e) => e.stopPropagation()}>
      {kinds.map((k) => {
        const d = DEFS[k];
        const iconOnly = compact && (k === "edit" || k === "delete" || k === "view");
        return (
          <Button
            key={k}
            size={iconOnly ? "icon" : "sm"}
            variant={d.variant}
            icon={d.icon}
            loading={pending === `${k}:${group.id}`}
            title={d.label}
            aria-label={d.label}
            onClick={() => onAction(k, group)}
            className={cn(
              iconOnly && "h-8 w-8",
              k === "delete" && "text-danger-600! hover:bg-danger-50! hover:text-danger-700!",
              k === "edit" && !iconOnly && "border border-line-strong",
            )}
          >
            {iconOnly ? null : compact ? (d.short ?? d.label) : d.label}
          </Button>
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
