"use client";

import { History, Pencil, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { fmtDateTime, fmtNumber, fmtTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Modal, useConfirm } from "@/components/ui/modal";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { num, type DailyEntry, type MachineQty } from "./types";

export interface HistoryEntry extends DailyEntry {
  order_key: string;
  order_number: string;
  suggestionMachines: string[];
}

function MachineLines({ e }: { e: DailyEntry }) {
  if (!e.machines?.length) return <span className="text-subtle">—</span>;
  return (
    <div className="space-y-0.5">
      {e.machines.map((m, i) => (
        <div key={`${m.machine_name}-${i}`} className="text-[13px]">
          <span className="text-muted">{m.machine_name}:</span> <span className="num font-medium">{fmtNumber(m.quantity)} t</span>
        </div>
      ))}
    </div>
  );
}

export function EntryHistory({ entries, editable, onChanged }: { entries: HistoryEntry[]; editable: boolean; onChanged: () => Promise<void> | void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<HistoryEntry | null>(null);

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
      await api.delete(`/api/warehouse/daily-entry/${e.id}`);
      toast.success("Đã xóa lần nhập kho. Tổng sản lượng đã được cập nhật lại.");
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const actions = (e: HistoryEntry) =>
    editable ? (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(e)}>
          Sửa
        </Button>
        <Button size="sm" variant="ghost" icon={Trash2} className="text-danger-600 hover:bg-danger-50 hover:text-danger-700" onClick={() => remove(e)}>
          Xóa
        </Button>
      </div>
    ) : null;

  return (
    <Card>
      <CardHeader
        icon={History}
        title="Lịch sử nhập trong ngày"
        description="Có thể sửa / xóa từng lần nhập trước khi chốt; hệ thống cập nhật đúng bản ghi cũ và tính lại tổng sản lượng."
      />
      {!entries.length ? (
        <EmptyState title="Chưa có lần nhập nào trong ngày." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <THead>
                <tr>
                  <Th>Thời gian</Th>
                  <Th>Đơn hàng</Th>
                  <Th>Máy / sản lượng</Th>
                  <Th align="right">Sang bao</Th>
                  <Th>Người nhập</Th>
                  {editable ? <Th align="right">Thao tác</Th> : null}
                </tr>
              </THead>
              <tbody>
                {entries.map((e) => (
                  <Tr key={e.id}>
                    <Td className="whitespace-nowrap">{fmtDateTime(e.created_at)}</Td>
                    <Td className="font-semibold">{e.order_number}</Td>
                    <Td>
                      <MachineLines e={e} />
                    </Td>
                    <Td align="right">{fmtNumber(e.repack_qty)} t</Td>
                    <Td>{e.created_by || "—"}</Td>
                    {editable ? <Td>{actions(e)}</Td> : null}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <ul className="divide-y divide-line md:hidden">
            {entries.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-fg">{e.order_number}</p>
                    <p className="text-xs text-muted">
                      {fmtTime(e.created_at)} · {e.created_by || "—"}
                    </p>
                  </div>
                  <span className="num text-[13px] text-muted">
                    Sang bao <b className="text-fg">{fmtNumber(e.repack_qty)} t</b>
                  </span>
                </div>
                <div className="mt-2">
                  <MachineLines e={e} />
                </div>
                {editable ? <div className="mt-2">{actions(e)}</div> : null}
              </li>
            ))}
          </ul>
        </>
      )}
      {editing ? <EditEntryModal entry={editing} onClose={() => setEditing(null)} onSaved={onChanged} /> : null}
    </Card>
  );
}

function EditEntryModal({ entry, onClose, onSaved }: { entry: HistoryEntry; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const names = [...new Set([...(entry.suggestionMachines || []), ...(entry.machines || []).map((m) => m.machine_name)])];
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(names.map((n) => [n, String(num(entry.machines.find((m) => m.machine_name === n)?.quantity))])),
  );
  const [repack, setRepack] = useState(String(num(entry.repack_qty)));
  const [saving, setSaving] = useState(false);

  async function save() {
    const machines: MachineQty[] = [];
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
        {names.map((n) => (
          <Field key={n} label={`${n} (tấn)`}>
            <Input type="number" inputMode="decimal" min={0} step="0.01" value={qty[n] ?? ""} onChange={(e) => setQty((q) => ({ ...q, [n]: e.target.value }))} />
          </Field>
        ))}
        <Field label="Sang bao (tấn)">
          <Input type="number" inputMode="decimal" min={0} step="0.01" value={repack} onChange={(e) => setRepack(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
