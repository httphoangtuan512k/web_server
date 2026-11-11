"use client";
/**
 * File này: hộp thoại "Phân quyền tài liệu" – tích chọn nhân viên và chọn "Chỉ xem" hoặc "Xem và cập nhật".
 * Dùng ở: nút "Phân quyền" trên trang /tai-lieu (chủ sở hữu và Super Admin).
 */

import { Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { EmptyState, Spinner } from "@/components/ui/card";
import { SearchInput, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { tlBtn } from "./tl-ui";
import type { DocPermission, DocUser, DocumentFile } from "./types";

// Hai mức quyền được cấp.
type Perm = "view" | "edit";

// Hộp thoại phân quyền một tài liệu. onSaved = tải lại danh sách sau khi lưu.
export function PermissionModal({ doc, onClose, onSaved }: { doc: DocumentFile; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const toast = useToast();
  // Danh sách nhân viên (null = đang tải) và quyền đã cấp theo mã người dùng.
  const [users, setUsers] = useState<DocUser[] | null>(null);
  const [grants, setGrants] = useState<Record<number, Perm>>({});
  // Lỗi, chữ tìm kiếm, đang lưu.
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  // Mở hộp thoại: tải cùng lúc danh sách nhân viên và quyền hiện có.
  useEffect(() => {
    let alive = true;
    Promise.all([api.get<{ users: DocUser[] }>("/api/tai-lieu/users"), api.get<{ permissions: DocPermission[] }>(`/api/tai-lieu/${doc.id}/permissions`)])
      .then(([u, p]) => {
        if (!alive) return;
        setUsers(u.users || []);
        // Đổi danh sách quyền thành bảng tra: mã người dùng → "view" / "edit".
        setGrants(Object.fromEntries((p.permissions || []).map((x) => [Number(x.user_id), x.permission === "edit" ? "edit" : "view"])));
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [doc.id]);

  // Lọc nhân viên theo chữ tìm (bỏ chủ sở hữu ra).
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (users || [])
      .filter((u) => u.id !== doc.owner_user_id)
      .filter((u) => !k || `${u.fullName} ${u.username} ${u.position}`.toLowerCase().includes(k));
  }, [users, q, doc.owner_user_id]);

  // Số người đã được cấp quyền.
  const count = Object.keys(grants).length;

  // Tích → cấp "Chỉ xem" (mặc định); bỏ tích → bỏ quyền.
  const toggle = (id: number, on: boolean) =>
    setGrants((g) => {
      const n = { ...g };
      if (on) n[id] = n[id] || "view";
      else delete n[id];
      return n;
    });

  // Nút "Lưu phân quyền": gửi toàn bộ danh sách quyền lên máy chủ.
  async function save() {
    setSaving(true);
    try {
      const permissions = Object.entries(grants).map(([userId, permission]) => ({ userId: Number(userId), permission }));
      const r = await api.put<{ ok: boolean; message?: string }>(`/api/tai-lieu/${doc.id}/permissions`, { permissions });
      toast.success(r?.message || "Đã lưu phân quyền.");
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
      size="lg"
      title="Phân quyền tài liệu"
      description={doc.original_name}
      footer={
        <>
          {/* Chân hộp thoại: số người đã cấp, nút "Đóng", nút "Lưu phân quyền". */}
          <span className="mr-auto self-center text-[13px] text-muted">Đã cấp quyền cho {count} người</span>
          <button type="button" className={cn(tlBtn.base, tlBtn.md, tlBtn.gray)} onClick={onClose}>
            Đóng
          </button>
          <button type="button" className={cn(tlBtn.base, tlBtn.md, tlBtn.blue)} disabled={!users || saving} onClick={save}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            Lưu phân quyền
          </button>
        </>
      }
    >
      {/* Hướng dẫn ngắn. */}
      <p className="mb-3 text-[13px] text-muted">
        Bỏ tích = không có quyền (không nhìn thấy tài liệu). Tích chọn rồi chọn quyền <b className="text-fg">Chỉ xem</b> hoặc{" "}
        <b className="text-fg">Xem và cập nhật</b>.
      </p>
      {/* Chưa có danh sách: lỗi hoặc vòng xoay. Có rồi: ô tìm + danh sách nhân viên. */}
      {!users ? (
        error ? (
          <p className="py-6 text-center text-sm text-danger-600">{error}</p>
        ) : (
          <Spinner />
        )
      ) : (
        <>
          <SearchInput placeholder="Tìm nhân viên…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
          {!list.length ? (
            <EmptyState icon={Users} title={users.length ? "Không tìm thấy nhân viên phù hợp." : "Không có tài khoản nhân viên hoạt động."} />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {/* Mỗi nhân viên: ô tích, tên, tài khoản · chức vụ, ô chọn mức quyền. */}
              {list.map((u) => {
                const granted = u.id in grants;
                return (
                  <li
                    key={u.id}
                    className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors", granted ? "border-brand-200 bg-brand-50/50" : "border-line")}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" className="h-4 w-4 shrink-0 accent-brand-600" checked={granted} onChange={(e) => toggle(u.id, e.target.checked)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">{u.fullName}</span>
                        <span className="block truncate text-xs text-muted">
                          {u.username}
                          {u.position ? ` · ${u.position}` : ""}
                        </span>
                      </span>
                    </label>
                    {/* Ô chọn mức quyền (chỉ bật khi đã tích). */}
                    <Select
                      aria-label={`Quyền của ${u.fullName}`}
                      value={grants[u.id] || "view"}
                      disabled={!granted}
                      onChange={(e) => setGrants((g) => ({ ...g, [u.id]: e.target.value as Perm }))}
                      className="h-8 w-[132px] shrink-0 text-[13px]"
                    >
                      <option value="view">Chỉ xem</option>
                      <option value="edit">Xem và cập nhật</option>
                    </Select>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
