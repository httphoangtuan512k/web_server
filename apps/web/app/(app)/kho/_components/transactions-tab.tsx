"use client";

import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { SearchInput, Select } from "@/components/ui/form";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { StockTxForm } from "./stock-tx-form";
import { CATEGORY_LABEL, type ItemCategory, type WarehouseData, type WarehouseTransaction } from "./types";

function ActionBadge({ action }: { action: string }) {
  return action === "in" ? (
    <Badge tone="success">
      <ArrowDownToLine size={12} /> Nhập kho
    </Badge>
  ) : (
    <Badge tone="danger">
      <ArrowUpFromLine size={12} /> Xuất kho
    </Badge>
  );
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

  return (
    <div className="space-y-5">
      {canEdit ? (
        <Card>
          <CardHeader icon={ArrowLeftRight} title="Ghi nhận nhập / xuất kho" description="Mọi giao dịch được lưu người thực hiện, thời gian và số lượng." />
          <div className="p-4 sm:p-5">
            <StockTxForm itemsByCategory={{ goods: data.goods, packaging: data.packaging, materials: data.materials }} onSaved={onChanged} />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          icon={ReceiptText}
          title="Lịch sử giao dịch"
          description="300 giao dịch gần nhất."
          actions={
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <SearchInput placeholder="Tìm tên hàng / người thực hiện" value={q} onChange={(e) => setQ(e.target.value)} className="col-span-2 sm:w-64" />
              <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Nhóm kho" className="sm:w-36">
                <option value="">Mọi nhóm</option>
                {(Object.keys(CATEGORY_LABEL) as ItemCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
              <Select value={act} onChange={(e) => setAct(e.target.value)} aria-label="Loại giao dịch" className="sm:w-32">
                <option value="">Nhập & xuất</option>
                <option value="in">Nhập kho</option>
                <option value="out">Xuất kho</option>
              </Select>
            </div>
          }
        />
        {!rows.length ? (
          <EmptyState icon={ReceiptText} title={data.transactions.length ? "Không có giao dịch phù hợp." : "Chưa có giao dịch."} />
        ) : (
          <>
            <div className="hidden md:block">
              <Table maxHeight="70vh">
                <THead>
                  <tr>
                    <Th>Thời gian</Th>
                    <Th>Nhóm</Th>
                    <Th>Mặt hàng</Th>
                    <Th>Loại</Th>
                    <Th align="right">Số lượng</Th>
                    <Th>Người thực hiện</Th>
                    <Th>Ghi chú</Th>
                  </tr>
                </THead>
                <tbody>
                  {rows.map((x) => (
                    <Tr key={x.id}>
                      <Td className="whitespace-nowrap text-muted">{fmtDateTime(x.created_at)}</Td>
                      <Td>{catLabel(x.category)}</Td>
                      <Td className="font-medium">{x.item_name}</Td>
                      <Td>
                        <ActionBadge action={x.action} />
                      </Td>
                      <Td align="right" className="font-semibold">
                        {fmtNumber(x.quantity)}
                      </Td>
                      <Td>{x.created_by || "—"}</Td>
                      <Td className="max-w-[280px] truncate text-muted" title={x.note}>
                        {x.note || "—"}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((x) => (
                <li key={x.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-fg">{x.item_name}</p>
                      <p className="text-xs text-muted">
                        {catLabel(x.category)} · {fmtDateTime(x.created_at)} · {x.created_by || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="num font-semibold text-fg">
                        {x.action === "in" ? "+" : "−"}
                        {fmtNumber(x.quantity)}
                      </span>
                      <ActionBadge action={x.action} />
                    </div>
                  </div>
                  {x.note ? <p className="mt-1 text-[13px] text-muted">{x.note}</p> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
