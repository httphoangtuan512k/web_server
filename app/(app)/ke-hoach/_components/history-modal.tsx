"use client";
/**
 * File này: hộp "Lịch sử thao tác đơn hàng" (50 bản ghi gần nhất); Super Admin sửa/xóa được.
 * Dùng ở: nút lịch sử trên trang Kế hoạch.
 */

import { History, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { Field, Input, SearchInput } from "@/components/ui/form";
import { Modal, useConfirm } from "@/components/ui/modal";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { HistoryPatch, HistoryRow } from "./types";
import { fromVnLocalInput, toVnLocalInput } from "./utils";

// In giá trị cũ/mới: rỗng → "—", số → định dạng VN.
const fmtVal = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : fmtNumber(v, 3, String(v)));

/**
 * Lịch sử thao tác đơn hàng (GET /api/history – 50 bản ghi mới nhất).
 * Super Admin: sửa (PATCH /api/history/:id) và xóa (DELETE /api/history/:id).
 */
export function HistoryModal({ initialQuery, isSuper, onClose }: { initialQuery: string; isSuper: boolean; onClose: () => void }) {
  // Thông báo, hộp xác nhận, danh sách bản ghi, lỗi, từ khóa lọc, bản ghi đang sửa, bản ghi đang xóa.
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(initialQuery);
  const [editing, setEditing] = useState<HistoryRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Tải 50 bản ghi lịch sử từ máy chủ.
  const load = useCallback(async () => {
    try {
      const d = await api.get<HistoryRow[]>("/api/history");
      setRows(Array.isArray(d) ? d : []);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  // Tải lần đầu khi mở hộp.
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Lọc theo từ khóa (số đơn, người, hành động, máy).
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!rows || !s) return rows ?? [];
    return rows.filter((r) =>
      [r.order_number, r.user_name, r.action, r.machine_name].some((x) =>
        String(x ?? "")
          .toLowerCase()
          .includes(s),
      ),
    );
  }, [rows, q]);

  /** Xóa 1 bản ghi: hỏi xác nhận (nút đỏ) → gọi API → tải lại. */
  async function remove(r: HistoryRow) {
    const ok = await confirm({
      title: "Xóa bản ghi lịch sử?",
      message: `${r.action} – đơn ${r.order_number} (${fmtDateTime(r.created_at)}). Thao tác này không thể hoàn tác.`,
      confirmText: "Xóa",
      danger: true,
    });
    if (!ok) return;
    setBusyId(r.id);
    try {
      await api.delete(`/api/history/${r.id}`);
      toast.success("Đã xóa bản ghi lịch sử.");
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    // Hộp lịch sử + (nếu đang sửa) hộp sửa bản ghi.
    <>
      {/* Hộp lớn: tiêu đề có icon; chân hộp nút "Tải lại" + "Đóng". */}
      <Modal
        open
        onClose={onClose}
        size="xl"
        title={
          <span className="flex items-center gap-2">
            <History size={18} className="text-brand-600" /> Lịch sử thao tác đơn hàng
          </span>
        }
        description="50 thao tác gần nhất (chạy, dừng, chạy thêm máy, xác nhận…)."
        footer={
          <>
            <Button variant="ghost" icon={RefreshCw} onClick={load}>
              Tải lại
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
          </>
        }
      >
        {/* Ô lọc nhanh. */}
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lọc theo số đơn, người thao tác, hành động, máy…" className="mb-3" />
        {/* Lỗi → chữ đỏ; đang tải → khối xám; không có → thông báo rỗng; có → bảng. */}
        {error ? (
          <p className="py-6 text-center text-sm text-danger-600">Không thể tải lịch sử: {error}</p>
        ) : !rows ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={History} title="Không có bản ghi phù hợp" description="Thử bỏ bớt từ khóa lọc." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            <Table maxHeight="60dvh">
              {/* Hàng tiêu đề; cột "Sửa / Xóa" chỉ cho Super Admin. */}
              <THead>
                <tr>
                  <Th>Thời gian</Th>
                  <Th>Số đơn</Th>
                  <Th>Máy</Th>
                  <Th>Người thao tác</Th>
                  <Th>Hành động</Th>
                  <Th align="right">Giá trị cũ</Th>
                  <Th align="right">Giá trị mới</Th>
                  {isSuper ? <Th align="right">Sửa / Xóa</Th> : null}
                </tr>
              </THead>
              <tbody>
                {shown.map((r) => (
                  // Mỗi bản ghi một dòng.
                  <Tr key={r.id}>
                    <Td className="num whitespace-nowrap text-muted">{fmtDateTime(r.created_at)}</Td>
                    <Td className="font-medium">{r.order_number}</Td>
                    <Td>{r.machine_name || "—"}</Td>
                    <Td>{r.user_name}</Td>
                    <Td>{r.action}</Td>
                    <Td align="right">{fmtVal(r.old_value)}</Td>
                    <Td align="right">{fmtVal(r.new_value)}</Td>
                    {/* Super Admin: nút ✎ sửa và nút 🗑 xóa (đỏ). */}
                    {isSuper ? (
                      <Td align="right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" icon={Pencil} className="h-8 w-8" aria-label="Sửa" title="Sửa" onClick={() => setEditing(r)} />
                          <Button
                            size="icon"
                            variant="ghost"
                            icon={Trash2}
                            className="h-8 w-8 text-danger-600! hover:bg-danger-50!"
                            aria-label="Xóa"
                            title="Xóa"
                            loading={busyId === r.id}
                            onClick={() => remove(r)}
                          />
                        </div>
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal>
      {/* Hộp sửa bản ghi (khi bấm ✎). */}
      {editing ? (
        <HistoryEditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

/** Hộp sửa 1 bản ghi lịch sử (chỉ Super Admin). */
function HistoryEditModal({ row, onClose, onSaved }: { row: HistoryRow; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const formId = useId();
  const [saving, setSaving] = useState(false);
  // Giá trị form, điền sẵn từ bản ghi.
  const [v, setV] = useState({
    order_number: row.order_number ?? "",
    machine_name: row.machine_name ?? "",
    user_name: row.user_name ?? "",
    action: row.action ?? "",
    old_value: row.old_value === null || row.old_value === undefined ? "" : String(row.old_value),
    new_value: row.new_value === null || row.new_value === undefined ? "" : String(row.new_value),
    created_at: toVnLocalInput(row.created_at),
  });
  // Cập nhật 1 ô khi gõ.
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  /** Bấm "Lưu": kiểm tra ô bắt buộc, đổi số, gửi PATCH, báo kết quả. */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const createdAt = fromVnLocalInput(v.created_at);
    if (!v.order_number.trim() || !v.user_name.trim() || !v.action.trim() || !createdAt) {
      return toast.error("Số đơn, người thao tác, hành động và thời gian không được để trống.");
    }
    const num = (s: string) => (s.trim() === "" ? 0 : Number.isFinite(Number(s)) ? Number(s) : s);
    const body: HistoryPatch = {
      order_number: v.order_number.trim(),
      machine_name: v.machine_name.trim(),
      user_name: v.user_name.trim(),
      action: v.action.trim(),
      old_value: num(v.old_value),
      new_value: num(v.new_value),
      created_at: createdAt,
    };
    setSaving(true);
    try {
      await api.patch(`/api/history/${row.id}`, { ...body });
      toast.success("Đã cập nhật lịch sử.");
      await onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    // Hộp vừa: chân hộp "Hủy" + "Lưu".
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Sửa bản ghi lịch sử"
      description="Thay đổi sẽ được ghi vào nhật ký quản trị."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Lưu
          </Button>
        </>
      }
    >
      {/* Lưới 2 cột các ô: số đơn, thời gian, người, máy, hành động, giá trị cũ/mới. */}
      <form id={formId} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Số đơn" required>
          <Input value={v.order_number} onChange={set("order_number")} required />
        </Field>
        <Field label="Thời gian" required>
          <Input type="datetime-local" value={v.created_at} onChange={set("created_at")} required />
        </Field>
        <Field label="Người thao tác" required>
          <Input value={v.user_name} onChange={set("user_name")} required />
        </Field>
        <Field label="Máy">
          <Input value={v.machine_name} onChange={set("machine_name")} />
        </Field>
        <Field label="Hành động" required className="sm:col-span-2">
          <Input value={v.action} onChange={set("action")} required />
        </Field>
        <Field label="Giá trị cũ">
          <Input type="number" step="any" value={v.old_value} onChange={set("old_value")} />
        </Field>
        <Field label="Giá trị mới">
          <Input type="number" step="any" value={v.new_value} onChange={set("new_value")} />
        </Field>
      </form>
    </Modal>
  );
}
