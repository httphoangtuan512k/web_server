"use client";

import { Download, FileSpreadsheet, History, LockOpen, Trash2, Upload, UserCog } from "lucide-react";
import { fmtBytes, fmtDateTime, fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
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

function PermBadge({ doc, isSuper }: { doc: DocumentFile; isSuper: boolean }) {
  const p = doc.my_permission;
  if (p === "owner") return <Badge tone="brand">{PERMISSION_LABEL.owner}</Badge>;
  if (isSuper) return <Badge tone="accent">Super Admin</Badge>;
  if (p === "edit") return <Badge tone="success">{PERMISSION_LABEL.edit}</Badge>;
  return <Badge tone="neutral">{PERMISSION_LABEL.view}</Badge>;
}

function RowActions({ doc, access, actions, busy }: { doc: DocumentFile; access: DocAccess; actions: DocActions; busy: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button size="sm" variant="secondary" icon={Download} loading={busy} onClick={() => actions.download(doc)}>
        Tải về
      </Button>
      {access.canUpdate ? (
        <Button size="sm" variant="primary" icon={Upload} onClick={() => actions.update(doc)}>
          Cập nhật
        </Button>
      ) : null}
      {access.canManage ? (
        <>
          <Button size="icon" variant="ghost" icon={UserCog} title="Phân quyền" aria-label="Phân quyền" onClick={() => actions.permissions(doc)} />
          <Button size="icon" variant="ghost" icon={History} title="Lịch sử hoạt động" aria-label="Lịch sử hoạt động" onClick={() => actions.history(doc)} />
        </>
      ) : null}
      {access.isSuper ? (
        <Button size="icon" variant="ghost" icon={LockOpen} title="Gỡ khóa chỉnh sửa" aria-label="Gỡ khóa chỉnh sửa" onClick={() => actions.unlock(doc)} />
      ) : null}
      {access.canManage ? (
        <Button
          size="icon"
          variant="ghost"
          icon={Trash2}
          title="Xóa tài liệu"
          aria-label="Xóa tài liệu"
          className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
          onClick={() => actions.remove(doc)}
        />
      ) : null}
    </div>
  );
}

function FileIcon() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success-50 text-success-700">
      <FileSpreadsheet size={18} />
    </span>
  );
}

export function DocumentList({
  docs,
  accessOf,
  actions,
  isSuper,
  downloading,
}: {
  docs: DocumentFile[];
  accessOf: (d: DocumentFile) => DocAccess;
  actions: DocActions;
  isSuper: boolean;
  downloading: string | null;
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">
        <Table>
          <THead>
            <tr>
              <Th>Tên tài liệu</Th>
              <Th>Chủ sở hữu</Th>
              <Th align="right">Kích thước</Th>
              <Th>Cập nhật</Th>
              <Th>Quyền của tôi</Th>
              <Th align="right">Thao tác</Th>
            </tr>
          </THead>
          <tbody>
            {docs.map((d) => (
              <Tr key={d.id}>
                <Td className="max-w-[380px]">
                  <div className="flex items-center gap-3">
                    <FileIcon />
                    <span className="truncate font-medium" title={d.original_name}>
                      {d.original_name}
                    </span>
                  </div>
                </Td>
                <Td>{d.owner_name || "—"}</Td>
                <Td align="right" className="text-muted">
                  {fmtBytes(Number(d.size_bytes))}
                </Td>
                <Td className="whitespace-nowrap" title={fmtDateTime(d.updated_at)}>
                  <span className="text-fg">{fmtRelative(d.updated_at)}</span>
                  <span className="block text-xs text-muted">{fmtDateTime(d.updated_at)}</span>
                </Td>
                <Td>
                  <PermBadge doc={d} isSuper={isSuper} />
                </Td>
                <Td>
                  <RowActions doc={d} access={accessOf(d)} actions={actions} busy={downloading === d.id} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
      {/* Mobile / tablet */}
      <ul className="divide-y divide-line lg:hidden">
        {docs.map((d) => (
          <li key={d.id} className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              <FileIcon />
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words text-fg">{d.original_name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {d.owner_name || "—"} · <span className="num">{fmtBytes(Number(d.size_bytes))}</span> · {fmtRelative(d.updated_at)}
                </p>
                <div className="mt-1.5">
                  <PermBadge doc={d} isSuper={isSuper} />
                </div>
              </div>
            </div>
            <div className="mt-2.5">
              <RowActions doc={d} access={accessOf(d)} actions={actions} busy={downloading === d.id} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
