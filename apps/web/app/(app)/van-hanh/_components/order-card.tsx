"use client";

import { CheckCircle2, ImageOff, Pause, PencilLine, Plus } from "lucide-react";
import { fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { SettingInput } from "./setting-input";
import { num, producedOf, remainingOf, type OperatorPerms, type Order } from "./types";

export interface OrderHandlers {
  onSplit: (o: Order) => void;
  onPause: (o: Order) => void;
  onComplete: (o: Order) => void;
  onEdit: (o: Order) => void;
  onImage: (o: Order) => void;
  onUpdateNum: (o: Order, field: "runOnMachine" | "actualProduced", raw: string) => Promise<boolean>;
}

const fmtPlain = (v: number | null | undefined) => String(num(v));

/** Thẻ 1 dòng đơn đang chạy trên 1 máy (thay 1 hàng của bảng cũ). */
export function OrderCard({ order: o, perms, handlers }: { order: Order; perms: OperatorPerms; handlers: OrderHandlers }) {
  const qty = num(o.quantity);
  const done = producedOf(o);
  const pct = qty > 0 ? Math.min(100, (done / qty) * 100) : 0;
  const remaining = remainingOf(o);

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => o.imageData && handlers.onImage(o)}
          disabled={!o.imageData}
          className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface-2 text-subtle enabled:hover:border-brand-500"
          aria-label={o.imageData ? `Xem ảnh đơn ${o.orderNumber}` : "Không có ảnh"}
        >
          {o.imageData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.imageData} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageOff size={20} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-fg">{o.orderNumber}</h3>
            <Badge tone="success" dot>
              Đang chạy
            </Badge>
            {perms.isSuper ? (
              <Button size="sm" variant="ghost" icon={PencilLine} onClick={() => handlers.onEdit(o)} className="ml-auto">
                Sửa toàn bộ
              </Button>
            ) : null}
          </div>
          <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
            <Info label="Mã bao bì" value={o.packagingCode || "Không có"} />
            <Info label="Cỡ hạt" value={o.grainSize} />
            <Info label="Loại đá" value={o.stoneType} />
            <Info label="Độ trắng" value={o.whiteness} />
          </dl>
        </div>
      </div>

      {/* Tiến độ */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
          <span className="text-muted">
            Tiến độ <span className="num font-semibold text-fg">{fmtNumber(done)}</span>
            <span className="num"> / {fmtNumber(qty)} tấn</span>
          </span>
          <span className="num font-semibold text-danger-600">Còn lại {fmtNumber(remaining)} tấn</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-success-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        {num(o.khoBu) ? <p className="num mt-1 text-xs text-muted">Gồm tồn kho bù {fmtNumber(o.khoBu)} tấn</p> : null}
      </div>

      {/* Số liệu */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReadOnly label="Tổng SL (tấn)" value={fmtNumber(qty)} />
        {perms.canOperate ? (
          <SettingInput label="Đã chạy (tấn)" unit="t" value={o.runOnMachine} format={fmtPlain} onCommit={(raw) => handlers.onUpdateNum(o, "runOnMachine", raw)} />
        ) : (
          <ReadOnly label="Đã chạy (tấn)" value={fmtNumber(num(o.runOnMachine))} />
        )}
        {perms.isSuper ? (
          <SettingInput label="Thực tế (tấn)" unit="t" value={o.actualProduced} format={fmtPlain} onCommit={(raw) => handlers.onUpdateNum(o, "actualProduced", raw)} />
        ) : (
          <ReadOnly label="Thực tế (tấn)" value={fmtNumber(num(o.actualProduced))} hint="Nhập tại trang Kho" />
        )}
      </div>

      {/* Thao tác */}
      {perms.canOperate || perms.canConfirm ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {perms.canOperate ? (
            <>
              <Button size="lg" variant="primary" icon={Plus} onClick={() => handlers.onSplit(o)}>
                Chạy thêm máy
              </Button>
              <Button size="lg" variant="accent" icon={Pause} onClick={() => handlers.onPause(o)}>
                Tạm dừng máy
              </Button>
            </>
          ) : null}
          {perms.canConfirm ? (
            <Button size="lg" variant="success" icon={CheckCircle2} onClick={() => handlers.onComplete(o)}>
              Xác nhận hoàn thành
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-center text-[13px] text-muted">Chỉ xem – tài khoản chưa được cấp quyền vận hành máy.</p>
      )}
      {o.runnerName ? <p className="-mt-2 text-xs text-subtle">Người chạy: {o.runnerName}</p> : null}
    </article>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-subtle">{label}</dt>
      <dd className="truncate font-medium text-fg">{value || "—"}</dd>
    </div>
  );
}

function ReadOnly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="num flex h-11 items-center justify-end rounded-[10px] bg-surface-3 px-3 text-base font-semibold text-fg">{value}</span>
      {hint ? <span className="text-[11px] text-subtle">{hint}</span> : null}
    </div>
  );
}
