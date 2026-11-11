"use client";

import { FileClock, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, Spinner } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/modal";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useApiData } from "../../_shared/use-api-data";
import { matchesQuery, normalizeText } from "../../_shared/utils";
import { ActionBadge, ValueChange } from "./action-badge";
import { HistoryEditModal } from "./history-edit-modal";
import type { HistoryRow } from "./types";

/** Lịch sử đơn hàng – GET /api/history (50 bản ghi mới nhất). Sửa/xóa: chỉ Super Admin. */
export function OrderHistory() {
  const { me } = useAuth();
  const isSuper = !!me?.isSuper;
  const toast = useToast();
  const confirm = useConfirm();
  const { data: rows, error, loading, reload } = useApiData<HistoryRow[]>("/api/history");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<HistoryRow | null>(null);

  const refresh = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  const filtered = useMemo(() => {
    const nq = normalizeText(q.trim());
    return (rows ?? []).filter((r) => matchesQuery(nq, r.order_number, r.machine_name, r.user_name, r.action));
  }, [rows, q]);

  async function remove(r: HistoryRow) {
    const ok = await confirm({
      title: `Xóa bản ghi lịch sử #${r.id}?`,
      message: (
        <>
          Bản ghi <b className="text-fg">{r.action}</b> của đơn <b className="text-fg">{r.order_number}</b> ({fmtDateTime(r.created_at)}) sẽ bị xóa. Thao tác
          được ghi vào nhật ký quản trị và không thể hoàn tác.
        </>
      ),
      confirmText: "Xóa bản ghi",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/history/${r.id}`);
      toast.success("Đã xóa bản ghi lịch sử.");
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader
        icon={FileClock}
        title="Lịch sử đơn hàng"
        description={isSuper ? "50 thay đổi gần nhất. Super Admin có thể sửa hoặc xóa bản ghi." : "50 thay đổi gần nhất."}
        actions={
          <>
            <SearchInput className="w-full sm:w-64" placeholder="Tìm số đơn, máy, người…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant="secondary" size="md" icon={RefreshCw} loading={loading} onClick={refresh}>
              Làm mới
            </Button>
          </>
        }
      />
      {error && !rows ? (
        <EmptyState icon={FileClock} title="Không tải được lịch sử" description={error} />
      ) : !rows ? (
        <Spinner />
      ) : !filtered.length ? (
        <EmptyState icon={FileClock} title={rows.length ? "Không có bản ghi phù hợp" : "Chưa có lịch sử đơn hàng"} />
      ) : (
        <Table maxHeight="70vh">
          <THead>
            <tr>
              <Th>Thời gian</Th>
              <Th>Số đơn</Th>
              <Th>Máy</Th>
              <Th>Người thao tác</Th>
              <Th>Hành động</Th>
              <Th>Thay đổi</Th>
              {isSuper ? <Th align="right">Thao tác</Th> : null}
            </tr>
          </THead>
          <tbody>
            {filtered.map((r) => (
              <Tr key={r.id}>
                <Td className="num whitespace-nowrap text-muted">{fmtDateTime(r.created_at)}</Td>
                <Td className="font-medium whitespace-nowrap">{r.order_number}</Td>
                <Td className="whitespace-nowrap">{r.machine_name || <span className="text-subtle">—</span>}</Td>
                <Td className="whitespace-nowrap">{r.user_name}</Td>
                <Td>
                  <ActionBadge action={r.action} />
                </Td>
                <Td>
                  <ValueChange oldValue={r.old_value} newValue={r.new_value} />
                </Td>
                {isSuper ? (
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(r)}>
                        Sửa
                      </Button>
                      <Button variant="ghost" size="sm" icon={Trash2} className="hover:bg-danger-50 hover:text-danger-600" onClick={() => remove(r)}>
                        Xóa
                      </Button>
                    </div>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing ? <HistoryEditModal row={editing} onClose={() => setEditing(null)} onSaved={refresh} /> : null}
    </Card>
  );
}
