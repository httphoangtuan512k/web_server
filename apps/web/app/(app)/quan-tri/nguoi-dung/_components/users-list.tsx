"use client";

import { KeyRound, Lock, LockOpen, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/card";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { UserAvatar } from "../../_shared/user-avatar";
import { KHO_EDIT, ORDER_PERMS, PAGE_PERMS, ROLE_LABEL } from "./constants";
import { orderPermsOf, type UserAccount } from "./types";

export interface UserActions {
  onEdit: (u: UserAccount) => void;
  onPassword: (u: UserAccount) => void;
  onToggleActive: (u: UserAccount) => void;
  onDelete: (u: UserAccount) => void;
}

const shortOf = (list: { value: string; short: string }[], v: string) => list.find((o) => o.value === v)?.short ?? v;

function PermSummary({ user }: { user: UserAccount }) {
  const isAdmin = user.role === "admin";
  const pages = (user.pagePermissions || []).filter((p) => p !== KHO_EDIT.value);
  const orders = orderPermsOf(user);
  const khoEdit = (user.pagePermissions || []).includes(KHO_EDIT.value);
  if (isAdmin) {
    return (
      <div className="flex flex-wrap gap-1">
        <Badge tone="brand">Toàn quyền</Badge>
        {khoEdit ? <Badge tone="accent">{KHO_EDIT.short}</Badge> : null}
      </div>
    );
  }
  if (!pages.length && !orders.length && !khoEdit) return <span className="text-[13px] text-subtle">Chưa cấp quyền</span>;
  return (
    <div className="flex max-w-[340px] flex-col gap-1.5">
      {pages.length || khoEdit ? (
        <div className="flex flex-wrap gap-1">
          {pages.map((p) => (
            <Badge key={p}>{shortOf(PAGE_PERMS, p)}</Badge>
          ))}
          {khoEdit ? <Badge tone="accent">{KHO_EDIT.short}</Badge> : null}
        </div>
      ) : null}
      {orders.length ? (
        <p className="text-xs text-muted">
          <span className="font-medium text-fg">Đơn hàng:</span> {orders.map((o) => shortOf(ORDER_PERMS, o)).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone, disabled }: { icon: LucideIcon; label: string; onClick: () => void; tone?: "danger" | "success"; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent",
        tone === "danger" && "hover:bg-danger-50 hover:text-danger-600",
        tone === "success" && "hover:bg-success-50 hover:text-success-600",
      )}
    >
      <Icon size={16} />
    </button>
  );
}

function Actions({ user, meId, actions }: { user: UserAccount; meId?: number; actions: UserActions }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton icon={Pencil} label="Sửa tài khoản" onClick={() => actions.onEdit(user)} />
      <ActionButton icon={KeyRound} label="Đổi mật khẩu" onClick={() => actions.onPassword(user)} />
      {user.active ? (
        <ActionButton icon={Lock} label="Khóa tài khoản" tone="danger" onClick={() => actions.onToggleActive(user)} disabled={user.id === meId} />
      ) : (
        <ActionButton icon={LockOpen} label="Mở khóa tài khoản" tone="success" onClick={() => actions.onToggleActive(user)} />
      )}
      <ActionButton icon={Trash2} label={user.id === meId ? "Không thể xóa chính mình" : "Xóa tài khoản"} tone="danger" onClick={() => actions.onDelete(user)} disabled={user.id === meId} />
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "success" : "danger"} dot>
      {active ? "Hoạt động" : "Đã khóa"}
    </Badge>
  );
}

function Person({ user }: { user: UserAccount }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar src={user.avatar} name={user.fullName || user.username} size={38} className={cn(!user.active && "opacity-50 grayscale")} />
      <div className="min-w-0">
        <p className="truncate font-medium text-fg">{user.fullName || user.username}</p>
        <p className="truncate text-xs text-muted">@{user.username}</p>
      </div>
    </div>
  );
}

export function UsersList({ users, meId, actions }: { users: UserAccount[]; meId?: number; actions: UserActions }) {
  return (
    <>
      {/* Bảng: tablet/desktop */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <tr>
              <Th>Nhân viên</Th>
              <Th>Chức danh</Th>
              <Th>Vai trò</Th>
              <Th>Phân quyền</Th>
              <Th>Trạng thái</Th>
              <Th align="right">Thao tác</Th>
            </tr>
          </THead>
          <tbody>
            {users.map((u) => (
              <Tr key={u.id} className={cn(!u.active && "bg-surface-2/60")}>
                <Td>
                  <Person user={u} />
                </Td>
                <Td className="text-muted">{u.position || "Chưa nhập"}</Td>
                <Td>
                  <Badge tone={u.role === "admin" ? "brand" : "neutral"}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                </Td>
                <Td className="whitespace-normal">
                  <PermSummary user={u} />
                </Td>
                <Td>
                  <StatusBadge active={u.active} />
                </Td>
                <Td>
                  <Actions user={u} meId={meId} actions={actions} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Thẻ: điện thoại */}
      <ul className="divide-y divide-line md:hidden">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <Person user={u} />
              <StatusBadge active={u.active} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <Badge tone={u.role === "admin" ? "brand" : "neutral"}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
              <span>{u.position || "Chưa nhập chức danh"}</span>
            </div>
            <PermSummary user={u} />
            <div className="-mr-1.5 border-t border-dashed border-line pt-2">
              <Actions user={u} meId={meId} actions={actions} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
