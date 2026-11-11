"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { KBtn, kTd, kTr } from "./kho-ui";
import { num, type DailyEntryGroup, type DailySuggestion, type MachineQty } from "./types";

const cellInput =
  "block w-full min-w-0 rounded-lg border border-[#c7d5e5] bg-white px-2 py-1.5 text-xs outline-none transition focus:border-[#7eadd9] focus:ring-3 focus:ring-[#d8eaff] disabled:bg-[#f4f7fb] disabled:text-[#66758a]";

/** Một dòng của bảng "Tổng hợp sản lượng theo đơn hàng" (giống bảng .order-summary cũ). */
export function OrderEntryRow({
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
  const todayRepack = num(agg?.repack);

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

  const td = cn(kTd, "px-2 text-xs");
  return (
    <tr className={kTr}>
      <td className={cn(td, "text-center")}>
        <b className="inline-flex min-w-[34px] items-center justify-center rounded-[7px] bg-[#edf4fb] px-2 py-1 text-[#173e67]">{order.order_number}</b>
      </td>
      <td className={cn(td, "text-[#40546b]")}>{order.packaging_code || "—"}</td>
      <td className={cn(td, "text-[#40546b]")}>{order.grain_size || "—"}</td>
      <td className={cn(td, "text-center font-bold whitespace-nowrap text-[#173e67] tabular-nums")}>{fmtNumber(total, 2, "0")} t</td>
      <td className={td}>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          aria-label={`Đã sản xuất – đơn ${order.order_number}`}
          title="Sản lượng đã sản xuất cộng dồn"
          value={cumulative}
          disabled={!editable}
          onChange={(e) => setCumulative(e.target.value)}
          className={cn(cellInput, "mx-auto min-h-9 max-w-[112px] border-[#a9bfd8] text-center text-[13px] font-bold text-[#173e67]")}
        />
      </td>
      <td className={td}>
        {machineNames.length ? (
          <div className="flex flex-col gap-1.5">
            {machineNames.map((name) => {
              const today = num(agg?.machines?.[name]);
              return (
                <label
                  key={name}
                  className="grid grid-cols-[minmax(34px,auto)_minmax(0,1fr)] items-center gap-[7px] rounded-lg border border-[#e4ebf3] bg-[#f8fafc] px-1.5 py-1"
                  title={today ? `Đã nhập hôm nay: ${fmtNumber(today)} tấn` : undefined}
                >
                  <span className="text-center font-bold whitespace-nowrap text-[#315577]">{name}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder={today ? `${fmtNumber(today)} đã nhập` : "Tấn"}
                    value={qty[name] ?? ""}
                    disabled={!editable}
                    onChange={(e) => setQty((q) => ({ ...q, [name]: e.target.value }))}
                    className={cn(cellInput, "min-h-[34px] text-right font-semibold")}
                  />
                </label>
              );
            })}
          </div>
        ) : (
          <span className="text-[#66758a]">Chưa có máy xác nhận vận hành</span>
        )}
      </td>
      <td className={td}>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          aria-label={`Sang bao – đơn ${order.order_number}`}
          title={todayRepack ? `Đã nhập hôm nay: ${fmtNumber(todayRepack)} tấn` : undefined}
          placeholder={fmtNumber(todayRepack, 2, "0")}
          value={repack}
          disabled={!editable}
          onChange={(e) => setRepack(e.target.value)}
          className={cn(cellInput, "min-h-9 text-center")}
        />
      </td>
      <td className={cn(td, "text-center")}>
        <b className="inline-block rounded-[7px] bg-[#fff6e8] px-[7px] py-1 whitespace-nowrap text-[#9a5b0b] tabular-nums">{fmtNumber(remain, 2, "0")} t</b>
      </td>
      <td className={td}>
        <input
          type="text"
          maxLength={1000}
          aria-label={`Ghi chú – đơn ${order.order_number}`}
          placeholder="Ghi chú..."
          value={note}
          disabled={!editable}
          onChange={(e) => setNote(e.target.value)}
          className={cn(cellInput, "min-h-9")}
        />
      </td>
      <td className={cn(td, "px-1.5")}>
        <div className="flex flex-col gap-[5px]">
          <KBtn variant="green" size="sm" loading={savingEntry} disabled={!editable} onClick={saveEntry} title="Lưu sản lượng hôm nay" className="w-full px-1 text-[11px]">
            Lưu
          </KBtn>
          <KBtn
            variant="secondary"
            size="sm"
            loading={savingSum}
            disabled={!editable}
            onClick={saveCumulative}
            title="Sửa tổng cộng dồn & ghi chú"
            className="w-full px-1 text-[11px] text-[#315577]"
          >
            Σ
          </KBtn>
        </div>
      </td>
    </tr>
  );
}
