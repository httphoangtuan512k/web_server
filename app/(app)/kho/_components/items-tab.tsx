"use client";

import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ItemFormModal } from "./item-form-modal";
import { KBtn, KCard, KEmptyRow, KNotice, KPill, KTable, kInput, kTd, kTh, kTr } from "./kho-ui";
import { StockTxForm } from "./stock-tx-form";
import type { ItemCategory, WarehouseItem } from "./types";

interface Col {
  key: string;
  label: string;
  render: (x: WarehouseItem) => React.ReactNode;
  align?: "right";
  /** Cột chính (hiển thị đậm, làm tiêu đề thẻ trên mobile). */
  primary?: boolean;
}

const Shelf = ({ v }: { v?: string }) => (v ? <KPill>{v}</KPill> : <span className="text-[#66758a]">—</span>);
const Qty = ({ x }: { x: WarehouseItem }) => <b className="tabular-nums">{fmtNumber(x.quantity, 2, "0")}</b>;
const dash = (v?: string) => v || "—";

const CONFIG: Record<
  ItemCategory,
  { title: string; description: string; notice: string; search: string; empty: string; add: string; filter: (x: WarehouseItem) => string; cols: Col[] }
> = {
  goods: {
    title: "Hàng hóa trong kho",
    description: "Theo dõi tồn hiện tại và các giao dịch nhập / xuất.",
    notice: "Ghi nhận nhập / xuất hàng hóa ngay tại đây.",
    search: "Tìm tên hoặc mã hàng",
    empty: "Chưa có hàng hóa trong danh mục.",
    add: "Thêm hàng hóa",
    filter: (x) => `${x.name} ${x.code || ""} ${x.grain_size || ""}`,
    cols: [
      { key: "code", label: "Mã hàng", render: (x) => dash(x.code) },
      { key: "name", label: "Tên hàng", render: (x) => x.name, primary: true },
      { key: "grain", label: "Cỡ hạt", render: (x) => dash(x.grain_size) },
      { key: "qty", label: "Tồn hiện tại", render: (x) => <Qty x={x} />, align: "right" },
      { key: "unit", label: "Đơn vị", render: (x) => dash(x.unit) },
    ],
  },
  packaging: {
    title: "Quản lý bao bì",
    description: "Theo dõi theo tên bao bì và số lô để kiểm tra số lượng còn.",
    notice: "Nhập kho khi nhận bao bì mới; xuất kho khi cấp bao bì cho sản xuất.",
    search: "Tìm tên bao bì hoặc số lô",
    empty: "Chưa có bao bì. Thêm danh mục để bắt đầu theo dõi.",
    add: "Thêm bao bì",
    filter: (x) => `${x.name} ${x.lot_number || ""}`,
    cols: [
      { key: "name", label: "Tên bao bì", render: (x) => x.name, primary: true },
      { key: "lot", label: "Số lô", render: (x) => dash(x.lot_number) },
      { key: "qty", label: "Tồn hiện tại", render: (x) => <Qty x={x} />, align: "right" },
      { key: "unit", label: "Đơn vị", render: (x) => dash(x.unit) },
    ],
  },
  materials: {
    title: "Danh mục vật tư theo vị trí kệ",
    description: "Nhập tên vật tư để tra nhanh số kệ / mã vị trí tương ứng.",
    notice: "Nhập kho khi mua / nhận vật tư; xuất kho khi cấp cho bộ phận sử dụng.",
    search: "Gõ tên vật tư hoặc số kệ...",
    empty: "Không tìm thấy vật tư phù hợp.",
    add: "Thêm vật tư",
    filter: (x) => `${x.name} ${x.shelf_number || ""}`,
    cols: [
      { key: "shelf", label: "Vị trí kệ", render: (x) => <Shelf v={x.shelf_number} /> },
      { key: "name", label: "Tên vật tư", render: (x) => x.name, primary: true },
      { key: "qty", label: "Tồn hiện tại", render: (x) => <Qty x={x} />, align: "right" },
      { key: "unit", label: "Đơn vị", render: (x) => dash(x.unit) },
    ],
  },
};

export function ItemsTab({
  category,
  items,
  canEdit,
  onChanged,
}: {
  category: ItemCategory;
  items: WarehouseItem[];
  canEdit: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const cfg = CONFIG[category];
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<WarehouseItem | null | undefined>(undefined);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? items.filter((x) => cfg.filter(x).toLowerCase().includes(k)) : items;
  }, [items, q, cfg]);

  async function remove(x: WarehouseItem) {
    const ok = await confirm({
      title: `Xóa “${x.name}”?`,
      message: "Xóa danh mục này? Lịch sử giao dịch đã phát sinh vẫn được giữ.",
      danger: true,
      confirmText: "Xóa",
    });
    if (!ok) return;
    try {
      await api.delete(`/api/warehouse/items/${category}/${x.id}`);
      toast.success("Đã xóa danh mục.");
      await onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const actions = (x: WarehouseItem) =>
    canEdit ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <KBtn size="sm" variant="secondary" onClick={() => setEditing(x)}>
          Sửa
        </KBtn>
        <KBtn size="sm" variant="red" onClick={() => remove(x)}>
          Xóa
        </KBtn>
      </div>
    ) : (
      <span className="text-xs text-[#66758a]">Theo quyền được cấp</span>
    );

  const empty = { goods: [], packaging: [], materials: [] } as Record<ItemCategory, WarehouseItem[]>;
  const emptyText = items.length ? "Không tìm thấy mục phù hợp." : cfg.empty;
  const primary = cfg.cols.find((c) => c.primary)!;
  const rest = cfg.cols.filter((c) => !c.primary && c.key !== "qty" && c.key !== "unit");

  return (
    <KCard
      title={cfg.title}
      description={cfg.description}
      actions={
        <input
          type="search"
          aria-label={cfg.search}
          placeholder={cfg.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={cn(kInput, "sm:w-[260px]")}
        />
      }
    >
      <KNotice>{cfg.notice}</KNotice>

      {canEdit ? (
        <>
          <div className="mt-3.5 mb-[17px]">
            <StockTxForm category={category} itemsByCategory={{ ...empty, [category]: items }} onSaved={onChanged} />
          </div>
          <div className="mb-4">
            <KBtn variant="primary" onClick={() => setEditing(null)}>
              + {cfg.add}
            </KBtn>
          </div>
        </>
      ) : null}

      {/* Máy tính / máy tính bảng */}
      <div className="hidden sm:block">
        <KTable minWidth={640}>
          <thead>
            <tr>
              {cfg.cols.map((c) => (
                <th key={c.key} className={cn(kTh, c.align === "right" ? "text-right" : "text-left")}>
                  {c.label}
                </th>
              ))}
              <th className={cn(kTh, "text-left")}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length ? (
              <KEmptyRow colSpan={cfg.cols.length + 1}>{emptyText}</KEmptyRow>
            ) : (
              filtered.map((x) => (
                <tr key={x.id} className={kTr}>
                  {cfg.cols.map((c) => (
                    <td key={c.key} className={cn(kTd, c.align === "right" && "text-right", c.primary && "font-bold")}>
                      {c.render(x)}
                    </td>
                  ))}
                  <td className={kTd}>{actions(x)}</td>
                </tr>
              ))
            )}
          </tbody>
        </KTable>
      </div>

      {/* Điện thoại: dạng thẻ */}
      <div className="sm:hidden">
        {!filtered.length ? (
          <p className="rounded-xl border border-[#dce5ef] px-4 py-7 text-center text-[13px] text-[#66758a]">{emptyText}</p>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((x) => (
              <li key={x.id} className="rounded-xl border border-[#dce5ef] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[#12345a]">{primary.render(x)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#66758a]">
                      {rest.map((c) => (
                        <span key={c.key}>
                          {c.label}: <span className="text-[#1d2939]">{c.render(x)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="shrink-0 text-right text-lg text-[#12345a]">
                    <Qty x={x} /> <span className="text-xs text-[#66758a]">{x.unit}</span>
                  </p>
                </div>
                <div className="mt-2">{actions(x)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing !== undefined ? <ItemFormModal category={category} item={editing} onClose={() => setEditing(undefined)} onSaved={onChanged} /> : null}
    </KCard>
  );
}
