"use client";

import { ArrowLeftRight, Boxes, Package, Pencil, Plus, Trash2, Wrench, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/modal";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ItemFormModal } from "./item-form-modal";
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

const Shelf = ({ v }: { v?: string }) =>
  v ? <span className="inline-flex rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand-700">{v}</span> : <span className="text-subtle">—</span>;
const Qty = ({ x }: { x: WarehouseItem }) => <b className="num">{fmtNumber(x.quantity)}</b>;
const dash = (v?: string) => v || "—";

const CONFIG: Record<
  ItemCategory,
  { title: string; description: string; notice: string; search: string; empty: string; add: string; icon: LucideIcon; filter: (x: WarehouseItem) => string; cols: Col[] }
> = {
  goods: {
    title: "Hàng hóa trong kho",
    description: "Theo dõi tồn hiện tại và các giao dịch nhập / xuất.",
    notice: "Ghi nhận nhập / xuất hàng hóa ngay tại đây.",
    search: "Tìm tên hoặc mã hàng",
    empty: "Chưa có hàng hóa trong danh mục.",
    add: "Thêm hàng hóa",
    icon: Boxes,
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
    icon: Package,
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
    search: "Gõ tên vật tư hoặc số kệ…",
    empty: "Không tìm thấy vật tư phù hợp.",
    add: "Thêm vật tư",
    icon: Wrench,
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

  const actions = (x: WarehouseItem) => (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(x)}>
        Sửa
      </Button>
      <Button size="sm" variant="ghost" icon={Trash2} className="text-danger-600 hover:bg-danger-50 hover:text-danger-700" onClick={() => remove(x)}>
        Xóa
      </Button>
    </div>
  );

  const empty = { goods: [], packaging: [], materials: [] } as Record<ItemCategory, WarehouseItem[]>;

  return (
    <div className="space-y-5">
      {canEdit ? (
        <Card>
          <CardHeader icon={ArrowLeftRight} title="Ghi nhận nhập / xuất" description={cfg.notice} />
          <div className="p-4 sm:p-5">
            <StockTxForm category={category} itemsByCategory={{ ...empty, [category]: items }} onSaved={onChanged} />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          icon={cfg.icon}
          title={cfg.title}
          description={cfg.description}
          actions={
            <>
              <SearchInput placeholder={cfg.search} value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
              {canEdit ? (
                <Button icon={Plus} onClick={() => setEditing(null)}>
                  {cfg.add}
                </Button>
              ) : null}
            </>
          }
        />
        {!filtered.length ? (
          <EmptyState icon={cfg.icon} title={items.length ? "Không tìm thấy mục phù hợp." : cfg.empty} />
        ) : (
          <>
            <div className="hidden sm:block">
              <Table maxHeight="70vh">
                <THead>
                  <tr>
                    {cfg.cols.map((c) => (
                      <Th key={c.key} align={c.align}>
                        {c.label}
                      </Th>
                    ))}
                    <Th align="right">{canEdit ? "Thao tác" : ""}</Th>
                  </tr>
                </THead>
                <tbody>
                  {filtered.map((x) => (
                    <Tr key={x.id}>
                      {cfg.cols.map((c) => (
                        <Td key={c.key} align={c.align} className={c.primary ? "font-semibold" : undefined}>
                          {c.render(x)}
                        </Td>
                      ))}
                      <Td>{canEdit ? actions(x) : <span className="block text-right text-xs text-subtle">Chỉ xem</span>}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <ul className="divide-y divide-line sm:hidden">
              {filtered.map((x) => {
                const primary = cfg.cols.find((c) => c.primary)!;
                const rest = cfg.cols.filter((c) => !c.primary && c.key !== "qty" && c.key !== "unit");
                return (
                  <li key={x.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-fg">{primary.render(x)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          {rest.map((c) => (
                            <span key={c.key}>
                              {c.label}: <span className="text-fg">{c.render(x)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="shrink-0 text-right text-lg text-fg">
                        <Qty x={x} /> <span className="text-xs text-muted">{x.unit}</span>
                      </p>
                    </div>
                    {canEdit ? <div className="mt-1">{actions(x)}</div> : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {editing !== undefined ? <ItemFormModal category={category} item={editing} onClose={() => setEditing(undefined)} onSaved={onChanged} /> : null}
    </div>
  );
}
