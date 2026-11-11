"use client";

import { Activity, ClipboardList, Cog, FlaskConical, History, ImageOff, Maximize2, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { DetailField } from "./detail-field";
import { OperationTimeline } from "./operation-timeline";
import { OrderActionButtons, type OrderActionKind } from "./order-actions";
import { BTN_BASE, BTN_SECONDARY, ProductionProgress, StatusBadge } from "./order-bits";
import type { EditableOrderField, OrderGroup, OrderPerms } from "./types";
import { dateKey, fmtTons, remainingOf, toNum } from "./utils";

const NUMERIC: EditableOrderField[] = ["quantity", "runOnMachine", "actualProduced", "khoBu"];

function Section({ icon: Icon, title, aside, children }: { icon: typeof Cog; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
          <Icon size={15} className="text-brand-600" />
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const dash = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? <span className="text-subtle">—</span> : String(v));

/**
 * Chi tiết đơn (đã gộp nhóm). Super Admin sửa trực tiếp từng trường (PATCH /api/orders/:id trên dòng đại diện),
 * kể cả ngày tạo đơn. Kèm lịch sử vận hành & các thao tác chạy/dừng/xác nhận.
 */
export function OrderDetailModal({
  group,
  perms,
  version,
  pending,
  onClose,
  onAction,
  onOpenImage,
  onOpenHistory,
  onReload,
}: {
  group: OrderGroup;
  perms: OrderPerms;
  version: number;
  pending: string | null;
  onClose: () => void;
  onAction: (kind: OrderActionKind, g: OrderGroup) => void;
  onOpenImage: (src: string, title: string) => void;
  onOpenHistory: (orderNumber: string) => void;
  onReload: () => Promise<void>;
}) {
  const toast = useToast();
  const rep = group.rows[0] ?? group;
  const su = perms.isSuper;

  async function save(field: EditableOrderField, raw: string): Promise<boolean> {
    let value: string | number = raw;
    if (field === "createdAt" && !raw) {
      toast.error("Vui lòng chọn ngày tạo hợp lệ.");
      return false;
    }
    if (NUMERIC.includes(field)) {
      const n = Number(raw.replace(",", "."));
      if (raw === "" || !Number.isFinite(n)) {
        toast.error("Giá trị số không hợp lệ.");
        return false;
      }
      value = n;
    }
    try {
      await api.patch(`/api/orders/${encodeURIComponent(rep.id)}`, { [field]: value });
      await onReload();
      toast.success(field === "createdAt" ? "Đã cập nhật ngày tạo đơn." : "Đã lưu thay đổi!");
      return true;
    } catch (e) {
      toast.error(field === "createdAt" ? `Không lưu được ngày tạo: ${errorMessage(e)}` : `Lỗi lưu: ${errorMessage(e)}`);
      return false;
    }
  }

  /** Ô thông tin; Super Admin sửa được. */
  const F = (
    field: EditableOrderField,
    label: string,
    display: React.ReactNode,
    opts: { type?: "text" | "number" | "date"; multiline?: boolean; className?: string; value?: string } = {},
  ) => {
    const raw = rep[field as keyof typeof rep];
    return (
      <DetailField
        key={field}
        label={label}
        display={display}
        value={opts.value ?? (raw === null || raw === undefined ? "" : String(raw))}
        type={opts.type}
        multiline={opts.multiline}
        className={opts.className}
        editable={su}
        onSave={(v) => save(field, v)}
      />
    );
  };

  const remaining = remainingOf(group);
  const multi = group.rows.length > 1;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={
        <span className="flex flex-wrap items-center gap-2">
          Chi tiết: {group.orderNumber || "-"} - {group.itemCode || "-"}
          <StatusBadge order={group} />
        </span>
      }
      description={`Tạo lúc ${fmtDateTime(group.createdAt)}${group.creatorName ? ` bởi ${group.creatorName}` : ""}`}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <OrderActionButtons group={group} perms={perms} onAction={onAction} pending={pending} className="mr-auto" />
          <button type="button" onClick={() => onOpenHistory(group.orderNumber)} className={cn(BTN_BASE, "text-[#334155] shadow-none hover:bg-[#e8edf2] hover:brightness-100")}>
            <History size={15} />
            Nhật ký thao tác
          </button>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            Đóng
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Ảnh + tóm tắt sản xuất */}
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          {group.imageData ? (
            <button
              type="button"
              onClick={() => onOpenImage(group.imageData, `Đơn ${group.orderNumber}`)}
              className="group relative grid h-48 place-items-center overflow-hidden rounded-xl border border-line bg-surface-2 md:h-full md:min-h-44"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={group.imageData} alt={`Bao bì ${group.packagingCode}`} className="max-h-full max-w-full object-contain" />
              <span className="absolute right-2 bottom-2 grid h-7 w-7 place-items-center rounded-lg bg-surface/90 text-muted shadow-card group-hover:text-brand-600">
                <Maximize2 size={14} />
              </span>
            </button>
          ) : (
            <div className="grid h-32 place-items-center rounded-xl border border-dashed border-line-strong bg-surface-2 text-sm text-subtle md:h-full">
              <span className="flex flex-col items-center gap-1.5">
                <ImageOff size={20} />
                Không có ảnh
              </span>
            </div>
          )}
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Số lượng đặt" value={fmtTons(group.quantity)} unit="tấn" />
              <Metric label="Sản lượng" value={fmtTons(group.actualProduced)} unit="tấn" />
              <Metric label="Còn lại" value={fmtTons(remaining)} unit="tấn" />
              <Metric label="Đã chạy máy" value={fmtTons(group.runOnMachine)} unit="tấn" />
            </div>
            <ProductionProgress order={group} showRemaining={false} className="mt-4" />
            <div className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
              <p className="text-muted">
                Máy: <span className="font-medium text-fg">{group.machineNames.join(", ") || "—"}</span>
              </p>
              <p className="text-muted">
                Người chạy: <span className="font-medium text-fg">{group.runnerNames.join(" + ") || "—"}</span>
              </p>
              <p className="text-muted">
                Ngày hoàn thành: <span className="font-medium text-fg">{fmtDate(group.completedAt)}</span>
              </p>
              <p className="text-muted">
                Người xác nhận: <span className="font-medium text-fg">{group.confirmerName || "—"}</span>
              </p>
            </div>
          </div>
        </div>

        {su ? (
          <p className="rounded-lg border border-warning-600/25 bg-warning-50 px-3 py-2 text-[13px] text-warning-700">
            Chế độ Super Admin: bấm biểu tượng bút chì để sửa trực tiếp dữ liệu gốc
            {multi ? ` (áp dụng cho dòng máy ${rep.machineName || "mới nhất"} của đơn)` : ""}. Thay đổi không ghi vào lịch sử thao tác.
          </p>
        ) : null}

        <Section icon={ClipboardList} title="Thông tin đơn hàng">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {F("orderNumber", "Số đơn hàng", dash(rep.orderNumber))}
            {F("itemCode", "Mã hàng", dash(rep.itemCode))}
            {F("packagingCode", "Mã bao bì", dash(rep.packagingCode))}
            {F("quantity", "Số lượng (tấn)", <span className="num">{fmtTons(rep.quantity)}</span>, { type: "number" })}
            {F("exportDate", "Ngày xuất", fmtDate(rep.exportDate), { type: "date", value: dateKey(rep.exportDate) })}
            {F("createdAt", "Ngày tạo", fmtDate(rep.createdAt), { type: "date", value: dateKey(rep.createdAt) })}
          </div>
        </Section>

        <Section icon={FlaskConical} title="Quy cách sản phẩm">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {F("whiteness", "Độ trắng", dash(rep.whiteness))}
            {F("grainSize", "Cỡ hạt", dash(rep.grainSize))}
            {F("stoneType", "Loại đá", dash(rep.stoneType))}
            {F("bagWeight", "Trọng lượng bao", rep.bagWeight ? `${rep.bagWeight} kg` : dash(""), { type: "number" })}
            {F("coatingRate", "Tỷ lệ tráng", dash(rep.coatingRate))}
            {F("impurity", "Tạp chất", dash(rep.impurity))}
            {F("pallet", "Pallet", dash(rep.pallet), { className: "sm:col-span-2" })}
            {F("extraBag", "Thêm bao", dash(rep.extraBag))}
            {F("orderCommand", "Lệnh chạy máy", rep.orderCommand || <span className="text-subtle">Chưa có lệnh chạy máy</span>, {
              multiline: true,
              className: "sm:col-span-2 lg:col-span-3",
            })}
          </div>
        </Section>

        <Section icon={ShieldCheck} title="Sản xuất & ký nhận">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {F("runOnMachine", "Đã chạy máy", <span className="num">{fmtTons(rep.runOnMachine)}</span>, { type: "number" })}
            {F("khoBu", "Tồn kho bù", <span className="num">{fmtTons(rep.khoBu)}</span>, { type: "number" })}
            {su ? F("actualProduced", "Sản lượng thực tế (tấn)", <span className="num">{fmtTons(rep.actualProduced)}</span>, { type: "number" }) : null}
            {F("creatorName", "Người tạo đơn", dash(rep.creatorName))}
            {F("runnerName", "Người chạy", dash(rep.runnerName))}
            {F("confirmerName", "Người xác nhận", dash(rep.confirmerName))}
          </div>
          <p className="text-xs text-muted">Sản lượng thực tế được nhập và điều chỉnh tại trang Kho.</p>
        </Section>

        {multi ? (
          <Section icon={Cog} title={`Các máy chạy đơn (${group.rows.length})`}>
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {group.rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-surface px-3 py-2.5 text-[13px]">
                  <span className="min-w-24 font-medium text-fg">{r.machineName || "Chưa rõ máy"}</span>
                  <StatusBadge order={r} />
                  <span className="text-muted">Người chạy: {r.runnerName || "—"}</span>
                  <span className="num text-muted">Sản lượng: {fmtTons(toNum(r.actualProduced))} t</span>
                  <span className="ml-auto text-xs text-subtle">{fmtDateTime(r.createdAt)}</span>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <Section icon={Activity} title="Lịch sử vận hành và xác nhận">
          <OperationTimeline order={rep} version={version} />
        </Section>
      </div>
    </Modal>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="num mt-0.5 truncate text-lg font-semibold text-fg">
        {value}
        {unit ? <span className="ml-1 text-xs font-medium text-muted">{unit}</span> : null}
      </p>
    </div>
  );
}
