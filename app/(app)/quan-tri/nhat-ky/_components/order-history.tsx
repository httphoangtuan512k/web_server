"use client";
// File này: bảng "Lịch sử đơn hàng" (50 thay đổi gần nhất), có tìm kiếm; Super Admin được sửa/xóa.
// Dùng ở: trang Nhật ký, tab thứ hai.

import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { OgButton, OgEmptyRow, ogInput, OgTable, OgTd, OgTh, OgTr } from "../../_shared/og-button";
import { useApiData } from "../../_shared/use-api-data";
import { matchesQuery, normalizeText } from "../../_shared/utils";
import { ActionBadge, ValueChange } from "./action-badge";
import { HistoryEditModal } from "./history-edit-modal";
import type { HistoryRow } from "./types";

/** Lịch sử đơn hàng – GET /api/history (50 bản ghi mới nhất). Sửa/xóa: chỉ Super Admin. */
export function OrderHistory() {
  // Người đang đăng nhập; có phải Super Admin không.
  const { me } = useAuth();
  const isSuper = !!me?.isSuper;
  const toast = useToast();
  const confirm = useConfirm();
  // Tải lịch sử đơn hàng.
  const { data: rows, error, loading, reload } = useApiData<HistoryRow[]>("/api/history");
  // Ô tìm kiếm và bản ghi đang mở để sửa.
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<HistoryRow | null>(null);

  // Tải lại bảng, lỗi thì báo.
  const refresh = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  // Lọc theo từ khóa (số đơn, máy, người, hành động).
  const filtered = useMemo(() => {
    const nq = normalizeText(q.trim());
    return (rows ?? []).filter((r) => matchesQuery(nq, r.order_number, r.machine_name, r.user_name, r.action));
  }, [rows, q]);

  // Xóa bản ghi: hỏi xác nhận, gọi máy chủ, tải lại.
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

  // Số cột bảng (Super Admin có thêm cột "Thao tác").
  const cols = isSuper ? 7 : 6;
  return (
    <>
      {/* Thanh công cụ: tìm kiếm, nút Làm mới, ghi chú */}
      <div className="mb-4 flex flex-col gap-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 sm:mb-5 sm:flex-row sm:items-center">
        <input type="search" className={cn(ogInput, "min-h-[38px]! sm:w-72")} placeholder="Tìm số đơn, máy, người…" value={q} onChange={(e) => setQ(e.target.value)} />
        <OgButton variant="primary" className="self-start font-bold sm:self-auto" loading={loading} onClick={refresh}>
          Làm mới
        </OgButton>
        <span className="text-sm text-[#64748b] sm:ml-auto">
          {isSuper ? "50 thay đổi gần nhất · Super Admin có thể sửa hoặc xóa." : "50 thay đổi gần nhất."}
        </span>
      </div>

      {/* Bảng lịch sử */}
      <OgTable maxHeight="70vh" minWidth={isSuper ? 860 : 720}>
        <thead>
          <tr>
            <OgTh>Thời gian</OgTh>
            <OgTh>Số đơn hàng</OgTh>
            <OgTh>Máy</OgTh>
            <OgTh>Tài khoản</OgTh>
            <OgTh>Hành động</OgTh>
            <OgTh>Số lượng</OgTh>
            {isSuper ? <OgTh>Thao tác</OgTh> : null}
          </tr>
        </thead>
        <tbody>
          {/* Lỗi / đang tải / trống / các dòng */}
          {error && !rows ? (
            <OgEmptyRow colSpan={cols} tone="error">
              {error}
            </OgEmptyRow>
          ) : !rows ? (
            <OgEmptyRow colSpan={cols}>Đang tải dữ liệu...</OgEmptyRow>
          ) : !filtered.length ? (
            <OgEmptyRow colSpan={cols}>{rows.length ? "Không có bản ghi phù hợp." : "Chưa có lịch sử đơn hàng."}</OgEmptyRow>
          ) : (
            filtered.map((r) => (
              <OgTr key={r.id}>
                <OgTd className="num whitespace-nowrap text-[#64748b]">{fmtDateTime(r.created_at)}</OgTd>
                <OgTd className="font-semibold whitespace-nowrap">{r.order_number}</OgTd>
                <OgTd className="whitespace-nowrap">{r.machine_name || "-"}</OgTd>
                <OgTd className="font-bold whitespace-nowrap">{r.user_name}</OgTd>
                <OgTd>
                  <ActionBadge action={r.action} />
                </OgTd>
                <OgTd>
                  <ValueChange oldValue={r.old_value} newValue={r.new_value} />
                </OgTd>
                {/* Nút Sửa/Xóa: chỉ Super Admin */}
                {isSuper ? (
                  <OgTd>
                    <div className="flex gap-1.5">
                      <OgButton size="sm" onClick={() => setEditing(r)}>
                        Sửa
                      </OgButton>
                      <OgButton size="sm" variant="danger" onClick={() => remove(r)}>
                        Xóa
                      </OgButton>
                    </div>
                  </OgTd>
                ) : null}
              </OgTr>
            ))
          )}
        </tbody>
      </OgTable>
      {/* Hộp sửa bản ghi */}
      {editing ? <HistoryEditModal row={editing} onClose={() => setEditing(null)} onSaved={refresh} /> : null}
    </>
  );
}
