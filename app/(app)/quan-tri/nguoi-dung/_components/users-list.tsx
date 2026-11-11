"use client";
// File này: danh sách tài khoản – bảng trên máy tính, dạng thẻ trên điện thoại, kèm nút thao tác.
// Dùng ở: trang Người dùng.

import { cn } from "@/lib/cn";
import { OgButton, OgPill, OgTable, OgTd, OgTh, OgTr } from "../../_shared/og-button";
import { UserAvatar } from "../../_shared/user-avatar";
import { KHO_EDIT, ORDER_PERMS, PAGE_PERMS, ROLE_LABEL } from "./constants";
import { orderPermsOf, type UserAccount } from "./types";

/** Các hàm xử lý khi bấm nút: Sửa, Đổi MK, Khóa/Mở, Xóa (trang cha truyền vào). */
export interface UserActions {
  onEdit: (u: UserAccount) => void;
  onPassword: (u: UserAccount) => void;
  onToggleActive: (u: UserAccount) => void;
  onDelete: (u: UserAccount) => void;
}

// Đổi mã quyền thành nhãn ngắn (vd "kehoach" → "Kế hoạch").
const shortOf = (list: { value: string; short: string }[], v: string) => list.find((o) => o.value === v)?.short ?? v;

/** Tóm tắt phân quyền (bổ sung so với trang cũ) – chữ nhỏ dưới nhãn quyền. */
function PermSummary({ user }: { user: UserAccount }) {
  const khoEdit = (user.pagePermissions || []).includes(KHO_EDIT.value);
  // Quản trị viên: "Toàn quyền" (+ "Sửa kho" nếu được tích).
  if (user.role === "admin") {
    return <p className="mt-1 text-xs text-[#64748b]">Toàn quyền{khoEdit ? ` · ${KHO_EDIT.short}` : ""}</p>;
  }
  // Nhân viên: liệt kê trang được vào và quyền đơn hàng.
  const pages = (user.pagePermissions || []).filter((p) => p !== KHO_EDIT.value).map((p) => shortOf(PAGE_PERMS, p));
  if (khoEdit) pages.push(KHO_EDIT.short);
  const orders = orderPermsOf(user).map((o) => shortOf(ORDER_PERMS, o));
  if (!pages.length && !orders.length) return <p className="mt-1 text-xs text-[#94a3b8]">Chưa cấp quyền</p>;
  return (
    <div className="mt-1 max-w-[320px] text-xs leading-relaxed text-[#64748b]">
      {pages.length ? <p>Trang: {pages.join(", ")}</p> : null}
      {orders.length ? <p>Đơn hàng: {orders.join(", ")}</p> : null}
    </div>
  );
}

/** Nút thao tác như admin.html: Sửa · Đổi MK · Khóa/Mở · Xóa. */
function Actions({ user, meId, actions }: { user: UserAccount; meId?: number; actions: UserActions }) {
  // Dòng này có phải tài khoản đang đăng nhập không (không cho tự khóa/xóa mình).
  const isMe = user.id === meId;
  return (
    <div className="flex flex-wrap gap-1.5">
      <OgButton onClick={() => actions.onEdit(user)}>Sửa</OgButton>
      <OgButton onClick={() => actions.onPassword(user)} title="Đổi mật khẩu">
        Đổi MK
      </OgButton>
      {/* Đang hoạt động → nút đỏ "Khóa"; đã khóa → nút xanh "Mở" */}
      <OgButton
        variant={user.active ? "danger" : "success"}
        onClick={() => actions.onToggleActive(user)}
        disabled={user.active && isMe}
        title={user.active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
      >
        {user.active ? "Khóa" : "Mở"}
      </OgButton>
      <OgButton variant="danger" onClick={() => actions.onDelete(user)} disabled={isMe} title={isMe ? "Không thể xóa chính mình" : "Xóa tài khoản"}>
        Xóa
      </OgButton>
    </div>
  );
}

/** Nhãn trạng thái: "Hoạt động" hoặc "Đã khóa" (hồng). */
function StatusPill({ active }: { active: boolean }) {
  return <OgPill tone={active ? "default" : "off"}>{active ? "Hoạt động" : "Đã khóa"}</OgPill>;
}

/** Ảnh đại diện + họ tên + tên đăng nhập (tài khoản bị khóa thì ảnh xám mờ). */
function Person({ user }: { user: UserAccount }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar src={user.avatar} name={user.fullName || user.username} className={cn(!user.active && "opacity-50 grayscale")} />
      <div className="min-w-0">
        <p className="truncate font-bold text-[#1e293b]">{user.fullName || user.username}</p>
        <p className="truncate text-xs text-[#666]">{user.username}</p>
      </div>
    </div>
  );
}

/** Danh sách tài khoản: bảng (Nhân viên, Chức danh, Quyền, Trạng thái, Thao tác) trên màn hình rộng, dạng thẻ trên điện thoại. */
export function UsersList({ users, meId, actions }: { users: UserAccount[]; meId?: number; actions: UserActions }) {
  return (
    <>
      {/* Màn hình rộng (≥ md): dạng bảng */}
      <div className="hidden md:block">
        <OgTable maxHeight="75vh">
          <thead>
            <tr>
              <OgTh>Nhân viên</OgTh>
              <OgTh>Chức danh</OgTh>
              <OgTh>Quyền</OgTh>
              <OgTh>Trạng thái</OgTh>
              <OgTh>Thao tác</OgTh>
            </tr>
          </thead>
          <tbody>
            {/* Mỗi tài khoản một dòng (tài khoản bị khóa nền xám nhạt) */}
            {users.map((u) => (
              <OgTr key={u.id} className={cn(!u.active && "bg-[#fbfcfd]")}>
                <OgTd className="min-w-[200px]">
                  <Person user={u} />
                </OgTd>
                <OgTd>{u.position || "Chưa nhập"}</OgTd>
                <OgTd>
                  <OgPill>{ROLE_LABEL[u.role] ?? u.role}</OgPill>
                  <PermSummary user={u} />
                </OgTd>
                <OgTd>
                  <StatusPill active={u.active} />
                </OgTd>
                <OgTd className="min-w-[250px]">
                  <Actions user={u} meId={meId} actions={actions} />
                </OgTd>
              </OgTr>
            ))}
          </tbody>
        </OgTable>
      </div>

      {/* Điện thoại: mỗi tài khoản là một thẻ */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {users.map((u) => (
          <li key={u.id} className={cn("rounded-lg border border-[#e2e8f0] p-3", u.active ? "bg-white" : "bg-[#fbfcfd]")}>
            {/* Người + trạng thái */}
            <div className="flex items-start justify-between gap-2">
              <Person user={u} />
              <StatusPill active={u.active} />
            </div>
            {/* Vai trò + chức danh */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-[#475569]">
              <OgPill>{ROLE_LABEL[u.role] ?? u.role}</OgPill>
              <span>{u.position || "Chưa nhập"}</span>
            </div>
            <PermSummary user={u} />
            {/* Hàng nút thao tác */}
            <div className="mt-3 border-t border-dashed border-[#e2e8f0] pt-3">
              <Actions user={u} meId={meId} actions={actions} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
