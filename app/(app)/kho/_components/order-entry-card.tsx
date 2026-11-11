"use client";

import { Save, Sigma } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { StatusBadge } from "./suggestion-list";
import { num, type DailyEntryGroup, type DailySuggestion, type MachineQty } from "./types";

export function OrderEntryCard({
  order,
  date,
  agg,
  editable,
  onSaved,
}: {
  order: DailySuggestion;
  date: string;
  agg?: DailyEntryGroup;
  editable: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const machineNames = order.machines.length ? order.machines : Object.keys(agg?.machines || {});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [repack, setRepack] = useState("");
  const [cumulative, setCumulative] = useState(String(num(order.produced_cumulative)));
  const [note, setNote] = useState(order.note || "");
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingSum, setSavingSum] = useState(false);

  const total = num(order.order_total);
  const produced = Number(cumulative);
  const producedOk = cumulative.trim() !== "" && Number.isFinite(produced) && produced >= 0;
  const remain = Math.max(0, total - (producedOk ? produced : 0));
  const pct = total > 0 ? Math.min(100, ((producedOk ? produced : 0) / total) * 100) : 0;

  async function saveEntry() {
    if (!editable) return;
    const machines: MachineQty[] = machineNames.map((name) => ({ machineName: name, quantity: Number(qty[name]) || 0 }));
    const repackQty = Number(repack) || 0;
    if (machines.some((m) => m.quantity < 0) || repackQty < 0) return toast.error("Sản lượng không được âm.");
    if (!machines.some((m) => m.quantity > 0) && repackQty <= 0) return toast.error("Bạn chưa nhập sản lượng hoặc sang bao.");
    setSavingEntry(true);
    try {
      await api.post("/api/warehouse/daily-entry", { date, orderKey: order.order_key, orderNumber: order.order_number, machines, repackQty });
      toast.success("Đã lưu lần nhập mới. Số liệu được cộng dồn và giữ lịch sử riêng.");
      setQty({});
      setRepack("");
      await onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingEntry(false);
    }
  }

  async function saveCumulative() {
    if (!editable) return;
    if (!producedOk) return toast.error("Khối lượng đã sản xuất không hợp lệ.");
    const ok = await confirm({
      title: "Điều chỉnh sản lượng lũy kế?",
      message: (
        <>
          Lưu khối lượng đã sản xuất cộng dồn <b className="num text-fg">{fmtNumber(produced)} tấn</b> và ghi chú cho đơn <b className="text-fg">{order.order_number}</b>.
        </>
      ),
      confirmText: "Lưu",
    });
    if (!ok) return;
    setSavingSum(true);
    try {
      await api.put(`/api/warehouse/order-production/${encodeURIComponent(order.order_key)}`, { producedCumulative: produced, note });
      toast.success("Đã cập nhật sản lượng cộng dồn và ghi chú.");
      await onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingSum(false);
    }
  }

  return (
    <Card className="flex flex-col">
      {/* Đầu thẻ */}
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-fg">{order.order_number}</h3>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            Bao bì {order.packaging_code || "—"} · Cỡ hạt {order.grain_size || "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Tổng đơn</p>
          <p className="num text-lg font-semibold text-fg">
            {fmtNumber(total)} <span className="text-xs font-medium text-muted">tấn</span>
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {/* Nhập phiếu theo máy */}
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Phiếu nhập hôm nay</p>
          <div className="grid grid-cols-2 gap-3">
            {machineNames.length ? (
              machineNames.map((name) => {
                const today = num(agg?.machines?.[name]);
                return (
                  <Field key={name} label={name} hint={today ? `Đã nhập hôm nay: ${fmtNumber(today)} t` : undefined}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="Tấn"
                      value={qty[name] ?? ""}
                      disabled={!editable}
                      onChange={(e) => setQty((q) => ({ ...q, [name]: e.target.value }))}
                    />
                  </Field>
                );
              })
            ) : (
              <p className="col-span-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">Chưa có máy xác nhận vận hành.</p>
            )}
            <Field label="Sang bao (tấn)" hint={num(agg?.repack) ? `Đã nhập hôm nay: ${fmtNumber(agg?.repack)} t` : undefined}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={fmtNumber(num(agg?.repack), 2, "0")}
                value={repack}
                disabled={!editable}
                onChange={(e) => setRepack(e.target.value)}
              />
            </Field>
          </div>
          {editable ? (
            <Button variant="success" icon={Save} loading={savingEntry} onClick={saveEntry} className="mt-3 w-full sm:w-auto">
              Lưu phiếu
            </Button>
          ) : null}
        </div>

        {/* Lũy kế & ghi chú */}
        <div className="rounded-xl border border-line bg-surface-2 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
            <span className="font-medium text-fg">Tiến độ đơn</span>
            <span className="num text-muted">
              Còn lại <b className="text-fg">{fmtNumber(remain)} t</b>
            </span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <Field label="Đã sản xuất (lũy kế, tấn)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={cumulative}
                disabled={!editable}
                onChange={(e) => setCumulative(e.target.value)}
              />
            </Field>
            <Field label="Ghi chú đơn hàng">
              <Input maxLength={1000} placeholder="Ghi chú…" value={note} disabled={!editable} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          {editable ? (
            <Button variant="secondary" size="sm" icon={Sigma} loading={savingSum} onClick={saveCumulative} className="mt-3">
              Lưu lũy kế &amp; ghi chú
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
