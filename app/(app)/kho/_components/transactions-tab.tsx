"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { KCard, KEmptyRow, KPill, KTable, kInput, kTd, kTh, kTr } from "./kho-ui";
import { StockTxForm } from "./stock-tx-form";
import { CATEGORY_LABEL, type ItemCategory, type WarehouseData, type WarehouseTransaction } from "./types";

function ActionBadge({ action }: { action: string }) {
  return action === "in" ? <KPill>Nhập kho</KPill> : <KPill tone="red">Xuất kho</KPill>;
}

const catLabel = (c: string) => CATEGORY_LABEL[c as ItemCategory] || c;

export function TransactionsTab({ data, canEdit, onChanged }: { data: WarehouseData; canEdit: boolean; onChanged: () => Promise<void> | void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [act, setAct] = useState("");

  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return data.transactions.filter(
      (x: WarehouseTransaction) =>
        (!cat || x.category === cat) && (!act || x.action === act) && (!k || `${x.item_name} ${x.created_by} ${x.note}`.toLowerCase().includes(k)),
    );
  }, [data.transactions, q, cat, act]);
  const emptyText = data.transactions.length ? "Không có giao dịch phù hợp." : "Chưa có giao dịch.";

  return (
    <div className="space-y-[17px]">
      {canEdit ? (
        <KCard title="Ghi nhận nhập / xuất kho" description="Mọi giao dịch được lưu người thực hiện, thời gian và số lượng.">
          <StockTxForm itemsByCategory={{ goods: data.goods, packaging: data.packaging, materials: data.materials }} onSaved={onChanged} />
        </KCard>
      ) : null}

      <KCard
        title="Lịch sử giao dịch"
        description="300 giao dịch gần nhất."
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <input
              type="search"
              aria-label="Tìm giao dịch"
              placeholder="Tìm tên hàng / người thực hiện"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={cn(kInput, "col-span-2 sm:w-[240px]")}
            />
            <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Nhóm kho" className={cn(kInput, "sm:w-36")}>
              <option value="">Mọi nhóm</option>
              {(Object.keys(CATEGORY_LABEL) as ItemCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <select value={act} onChange={(e) => setAct(e.target.value)} aria-label="Loại giao dịch" className={cn(kInput, "sm:w-32")}>
              <option value="">Nhập & xuất</option>
              <option value="in">Nhập kho</option>
              <option value="out">Xuất kho</option>
            </select>
          </div>
        }
      >
        {/* Máy tính / máy tính bảng */}
        <div className="hidden md:block">
          <KTable minWidth={820}>
            <thead>
              <tr>
                {["Thời gian", "Nhóm", "Mặt hàng", "Loại", "Số lượng", "Người thực hiện", "Ghi chú"].map((h) => (
                  <th key={h} className={cn(kTh, h === "Số lượng" ? "text-right" : "text-left")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <KEmptyRow colSpan={7}>{emptyText}</KEmptyRow>
              ) : (
                rows.map((x) => (
                  <tr key={x.id} className={kTr}>
                    <td className={cn(kTd, "whitespace-nowrap")}>{fmtDateTime(x.created_at)}</td>
                    <td className={kTd}>{catLabel(x.category)}</td>
                    <td className={cn(kTd, "font-semibold")}>{x.item_name}</td>
                    <td className={kTd}>
                      <ActionBadge action={x.action} />
                    </td>
                    <td className={cn(kTd, "text-right font-semibold tabular-nums")}>{fmtNumber(x.quantity, 2, "0")}</td>
                    <td className={kTd}>{x.created_by || "—"}</td>
                    <td className={cn(kTd, "max-w-[280px] text-[#40546b]")}>{x.note || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </KTable>
        </div>

        {/* Điện thoại: dạng thẻ */}
        <div className="md:hidden">
          {!rows.length ? (
            <p className="rounded-xl border border-[#dce5ef] px-4 py-7 text-center text-[13px] text-[#66758a]">{emptyText}</p>
          ) : (
            <ul className="space-y-2.5">
              {rows.map((x) => (
                <li key={x.id} className="rounded-xl border border-[#dce5ef] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-[#12345a]">{x.item_name}</p>
                      <p className="text-xs text-[#66758a]">
                        {catLabel(x.category)} · {fmtDateTime(x.created_at)} · {x.created_by || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <b className="tabular-nums text-[#12345a]">
                        {x.action === "in" ? "+" : "−"}
                        {fmtNumber(x.quantity, 2, "0")}
                      </b>
                      <ActionBadge action={x.action} />
                    </div>
                  </div>
                  {x.note ? <p className="mt-1 text-[13px] text-[#40546b]">{x.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </KCard>
    </div>
  );
}
