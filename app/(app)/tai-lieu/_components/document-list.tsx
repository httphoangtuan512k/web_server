"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format";
import { tlBtn } from "./tl-ui";
import { PERMISSION_LABEL, type DocumentFile } from "./types";

export interface DocActions {
  download: (d: DocumentFile) => void;
  update: (d: DocumentFile) => void;
  permissions: (d: DocumentFile) => void;
  history: (d: DocumentFile) => void;
  remove: (d: DocumentFile) => void;
  unlock: (d: DocumentFile) => void;
}

export interface DocAccess {
  canUpdate: boolean;
  canManage: boolean;
  isSuper: boolean;
}

/** Dung lượng kiểu bản gốc: "0.25 MB". */
const sizeMB = (d: DocumentFile) => `${(Number(d.size_bytes) / 1024 / 1024).toFixed(2)} MB`;

function permText(doc: DocumentFile, isSuper: boolean) {
  const p = doc.my_permission;
  if (p === "owner") return PERMISSION_LABEL.owner;
  if (p === "edit") return PERMISSION_LABEL.edit;
  if (isSuper && !p) return "Super Admin";
  return PERMISSION_LABEL.view;
}

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block rounded-full bg-[#eff6ff] px-2 py-1 text-[11px] whitespace-nowrap text-[#1d4ed8]">{children}</span>
);

/** Các nút thao tác – đúng chữ, màu, thứ tự của bản gốc (Gỡ khóa là nút mới, chỉ Super Admin). */
function RowActions({ doc, access, actions, busy }: { doc: DocumentFile; access: DocAccess; actions: DocActions; busy: boolean }) {
  const b = cn(tlBtn.base, tlBtn.sm);
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={cn(b, tlBtn.blue)} disabled={busy} onClick={() => actions.download(doc)}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : null}Xem / Tải
      </button>
      {access.canUpdate ? (
        <button type="button" className={cn(b, tlBtn.green)} onClick={() => actions.update(doc)}>
          Cập nhật
        </button>
      ) : null}
      {access.canManage ? (
        <>
          <button type="button" className={cn(b, tlBtn.gray)} onClick={() => actions.permissions(doc)}>
            Phân quyền
          </button>
          <button type="button" className={cn(b, tlBtn.gray)} onClick={() => actions.history(doc)}>
            Lịch sử
          </button>
        </>
      ) : null}
      {access.isSuper ? (
        <button type="button" className={cn(b, tlBtn.slate)} title="Gỡ khóa chỉnh sửa" onClick={() => actions.unlock(doc)}>
          Gỡ khóa
        </button>
      ) : null}
      {access.canManage ? (
        <button type="button" className={cn(b, tlBtn.red)} onClick={() => actions.remove(doc)}>
          Xóa
        </button>
      ) : null}
    </div>
  );
}

const th = "sticky top-0 z-[1] border-b border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-3 text-left text-[13px] font-bold whitespace-nowrap text-[#475569]";
const td = "border-b border-[#e2e8f0] px-2.5 py-3 text-left align-middle text-[13px]";

export function DocumentList({
  docs,
  accessOf,
  actions,
  isSuper,
  downloading,
  empty,
}: {
  docs: DocumentFile[];
  accessOf: (d: DocumentFile) => DocAccess;
  actions: DocActions;
  isSuper: boolean;
  downloading: string | null;
  /** Dòng thông báo thay cho danh sách (đang tải / lỗi / trống). */
  empty?: React.ReactNode;
}) {
  return (
    <>
      {/* Máy tính / máy tính bảng */}
      <div className="mt-3.5 hidden max-h-[70vh] overflow-auto overscroll-x-contain md:block">
        <table className="w-full min-w-[760px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={th}>Tên tài liệu</th>
              <th className={th}>Người tải lên</th>
              <th className={th}>Quyền của bạn</th>
              <th className={th}>Trạng thái</th>
              <th className={th}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={5} className={cn(td, "p-[30px] text-center text-[#64748b]")}>
                  {empty}
                </td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-[#f8fafc]">
                  <td className={cn(td, "max-w-[420px]")}>
                    <strong className="block [overflow-wrap:anywhere]">{d.original_name}</strong>
                    <span className="text-[13px] leading-relaxed text-[#64748b]" title={`Cập nhật ${fmtDateTime(d.updated_at)}`}>
                      {sizeMB(d)} · {fmtDateTime(d.updated_at)}
                    </span>
                  </td>
                  <td className={td}>{d.owner_name || "—"}</td>
                  <td className={td}>{permText(d, isSuper)}</td>
                  <td className={td}>
                    <Tag>Sẵn sàng</Tag>
                  </td>
                  <td className={td}>
                    <RowActions doc={d} access={accessOf(d)} actions={actions} busy={downloading === d.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Điện thoại: dạng thẻ */}
      <div className="mt-3.5 md:hidden">
        {empty ? (
          <p className="rounded-[10px] border border-[#e2e8f0] p-[30px] text-center text-[13px] text-[#64748b]">{empty}</p>
        ) : (
          <ul className="space-y-2.5">
            {docs.map((d) => (
              <li key={d.id} className="rounded-[10px] border border-[#e2e8f0] p-3 text-[13px]">
                <div className="flex items-start justify-between gap-2">
                  <strong className="min-w-0 text-sm [overflow-wrap:anywhere]">{d.original_name}</strong>
                  <Tag>Sẵn sàng</Tag>
                </div>
                <p className="mt-1 text-xs text-[#64748b]">
                  {sizeMB(d)} · {d.owner_name || "—"} · {fmtDateTime(d.updated_at)}
                </p>
                <p className="mt-1 text-xs text-[#475569]">
                  Quyền của bạn: <b>{permText(d, isSuper)}</b>
                </p>
                <div className="mt-2.5">
                  <RowActions doc={d} access={accessOf(d)} actions={actions} busy={downloading === d.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
