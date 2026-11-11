"use client";
/**
 * File này: bảng "Lịch sử nhập trong ngày" – từng lần nhập sản lượng, có nút Sửa / Xóa.
 * Dùng ở: tab "Tổng hợp cuối ngày" của trang /kho. Máy tính hiện bảng, điện thoại hiện thẻ.
 */

import { Save } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal, useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { KBtn, KCard, KEmptyRow, KTable, kTd, kTh, kTr } from "./kho-ui";
import { num, type DailyEntry, type MachineQty } from "./types";

// Một lần nhập kèm số đơn và danh sách máy gợi ý của đơn.
export interface HistoryEntry extends DailyEntry {
  order_key: string;
  order_number: string;
  suggestionMachines: string[];
}

// Liệt kê "Máy: số tấn" của một lần nhập.
function MachineLines({ e }: { e: DailyEntry }) {
  if (!e.machines?.length) return <span className="text-[#66758a]">—</span>;
  return (
    <div className="space-y-0.5">
      {e.machines.map((m, i) => (
        <div key={`${m.machine_name}-${i}`}>
          {m.machine_name}: <b className="tabular-nums">{fmtNumber(m.quantity, 2, "0")} tấn</b>
        </div>
      ))}
    </div>
  );
}

// Khối lịch sử nhập. editable = còn sửa được (có quyền, chưa chốt).
export function EntryHistory({
  entries,
  editable,
  onChanged,
  status,
}: {
  entries: HistoryEntry[];
  editable: boolean;
  onChanged: () => Promise<void> | void;
  /** Đang tải / lỗi – hiện thay cho các dòng. */
  status?: string | null;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  // Lần nhập đang mở hộp thoại sửa.
  const [editing, setEditing] = useState<HistoryEntry | null>(null);

  // Nút "Xóa": hỏi xác nhận (kèm chi tiết) → gọi API xóa → tải lại.
  async function remove(e: HistoryEntry) {
    const ok = await confirm({
      title: "Xóa lần nhập kho này?",
      danger: true,
      confirmText: "Xóa lần nhập",
      message: (
        <div className="space-y-1">
          <p>
            Đơn hàng: <b className="text-fg">{e.order_number}</b>
          </p>
          <p>Thời gian: {fmtDateTime(e.created_at)}</p>
          {(e.machines || []).map((m, i) => (
            <p key={i}>
              {m.machine_name}: <span className="num">{fmtNumber(m.quantity)} tấn</span>
            </p>
          ))}
          <p>
            Sang bao: <span className="num">{fmtNumber(e.repack_qty)} tấn</span>
          </p>
          <p className="pt-1">Tổng sản lượng đơn hàng sẽ được tính lại. Thao tác này không thể hoàn tác.</p>
        </div>
      ),
    });
    if (!ok) return;
    try {
      // Xóa trên máy chủ.
      await api.delete(`/api/warehouse/daily-entry/${e.id}`);
      toast.success("Đã xóa lần nhập kho. Tổng sản lượng đã được cập nhật lại.");
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  // Nút Sửa / Xóa của mỗi dòng (không sửa được thì hiện "—").
  const actions = (e: HistoryEntry) =>
    editable ? (
      <div className="flex flex-wrap items-center gap-2">
        <KBtn size="sm" variant="secondary" onClick={() => setEditing(e)}>
          Sửa
        </KBtn>
        <KBtn size="sm" variant="danger" onClick={() => remove(e)}>
          Xóa
        </KBtn>
      </div>
    ) : (
      <span className="text-[#66758a]">—</span>
    );

  // Câu thay cho bảng khi đang tải / lỗi / trống.
  const empty = status || (!entries.length ? "Chưa có lần nhập nào trong ngày." : null);

  return (
    <KCard title="Lịch sử nhập trong ngày" description="Có thể sửa / xóa từng lần nhập trước khi chốt; khi sửa hệ thống cập nhật bản ghi cũ và tính lại tổng sản lượng.">
      {/* Máy tính / máy tính bảng */}
      <div className="hidden md:block">
        <KTable minWidth={760}>
          <thead>
            <tr>
              {/* Tiêu đề 6 cột. */}
              {["Thời gian", "Đơn hàng", "Máy / sản lượng", "Sang bao", "Người nhập", "Thao tác"].map((h) => (
                <th key={h} className={cn(kTh, "text-left")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <KEmptyRow colSpan={6}>{empty}</KEmptyRow>
            ) : (
              // Mỗi lần nhập một dòng.
              entries.map((e) => (
                <tr key={e.id} className={kTr}>
                  <td className={cn(kTd, "whitespace-nowrap")}>{fmtDateTime(e.created_at)}</td>
                  <td className={kTd}>
                    <b>{e.order_number}</b>
                  </td>
                  <td className={kTd}>
                    <MachineLines e={e} />
                  </td>
                  <td className={cn(kTd, "font-semibold whitespace-nowrap tabular-nums")}>{fmtNumber(e.repack_qty, 2, "0")} tấn</td>
                  <td className={kTd}>{e.created_by || "—"}</td>
                  <td className={kTd}>{actions(e)}</td>
                </tr>
              ))
            )}
          </tbody>
        </KTable>
      </div>

      {/* Điện thoại: dạng thẻ */}
      <div className="md:hidden">
        {empty ? (
          <p className="rounded-xl border border-[#dce5ef] px-4 py-7 text-center text-[13px] text-[#66758a]">{empty}</p>
        ) : (
          <ul className="space-y-2.5">
            {/* Mỗi lần nhập một thẻ: số đơn, giờ · người, sang bao, máy. */}
            {entries.map((e) => (
              <li key={e.id} className="rounded-xl border border-[#dce5ef] p-3 text-[13px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <b className="text-[15px] text-[#12345a]">{e.order_number}</b>
                    <p className="text-xs text-[#66758a]">
                      {fmtDateTime(e.created_at)} · {e.created_by || "—"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-[#66758a]">
                    Sang bao <b className="text-[13px] text-[#1d2939] tabular-nums">{fmtNumber(e.repack_qty, 2, "0")} tấn</b>
                  </span>
                </div>
                <div className="mt-2">
                  <MachineLines e={e} />
                </div>
                {editable ? <div className="mt-2.5">{actions(e)}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Hộp thoại sửa (khi đang sửa). */}
      {editing ? <EditEntryModal entry={editing} onClose={() => setEditing(null)} onSaved={onChanged} /> : null}
    </KCard>
  );
}

// Hộp thoại sửa một lần nhập: sửa số tấn từng máy và sang bao.
function EditEntryModal({ entry, onClose, onSaved }: { entry: HistoryEntry; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const toast = useToast();
  const confirm = useConfirm();
  // Tên các máy (gộp máy gợi ý và máy đã nhập, không trùng).
  const names = [...new Set([...(entry.suggestionMachines || []), ...(entry.machines || []).map((m) => m.machine_name)])];
  // Số tấn từng máy, điền sẵn số cũ.
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(names.map((n) => [n, String(num(entry.machines.find((m) => m.machine_name === n)?.quantity))])),
  );
  // Sang bao và trạng thái đang lưu.
  const [repack, setRepack] = useState(String(num(entry.repack_qty)));
  const [saving, setSaving] = useState(false);

  // Bấm "Lưu thay đổi": kiểm tra số → hỏi xác nhận → gửi lên máy chủ.
  async function save() {
    const machines: MachineQty[] = [];
    // Kiểm tra từng máy: số hợp lệ, không âm.
    for (const n of names) {
      const q = Number(qty[n] || 0);
      if (!Number.isFinite(q) || q < 0) return toast.error(`Sản lượng máy ${n} không hợp lệ.`);
      machines.push({ machineName: n, quantity: q });
    }
    const repackQty = Number(repack || 0);
    if (!Number.isFinite(repackQty) || repackQty < 0) return toast.error("Sản lượng sang bao không hợp lệ.");
    if (!(await confirm({ title: "Lưu thay đổi?", message: "Lưu vào đúng bản ghi cũ. Tổng sản lượng đơn hàng sẽ được tính lại.", confirmText: "Lưu thay đổi" }))) return;
    setSaving(true);
    try {
      // Ghi đè đúng bản ghi cũ trên máy chủ.
      await api.put(`/api/warehouse/daily-entry/${entry.id}`, { machines, repackQty });
      toast.success("Đã cập nhật bản ghi và đồng bộ sản lượng sang Kế hoạch.");
      onClose();
      await onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Sửa lần nhập · ${entry.order_number}`}
      description={`Lúc ${fmtDateTime(entry.created_at)} · ${entry.created_by || ""}`}
      footer={
        <>
          {/* Nút "Hủy" và "Lưu thay đổi". */}
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button icon={Save} loading={saving} onClick={save}>
            Lưu thay đổi
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {/* Mỗi máy một ô nhập tấn. */}
        {names.map((n) => (
          <Field key={n} label={`${n} (tấn)`}>
            <Input type="number" inputMode="decimal" min={0} step="0.01" value={qty[n] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [n]: e.target.value }))} />
          </Field>
        ))}
        {/* Ô sang bao. */}
        <Field label="Sang bao (tấn)">
          <Input type="number" inputMode="decimal" min={0} step="0.01" value={repack} onChange={(e) => setRepack(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
