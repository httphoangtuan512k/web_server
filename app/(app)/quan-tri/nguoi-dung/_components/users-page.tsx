"use client";

import { MonitorSmartphone, RefreshCw, ShieldCheck, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui/card";
import { SearchInput, Select } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { PageGuard } from "@/components/shell/page-guard";
import { useApiData } from "../../_shared/use-api-data";
import { matchesQuery, normalizeText } from "../../_shared/utils";
import { LoginSessions } from "./login-sessions";
import { PasswordModal } from "./password-modal";
import type { UserAccount } from "./types";
import { UserFormModal } from "./user-form-modal";
import { UsersList, type UserActions } from "./users-list";

type Tab = "accounts" | "sessions";

export function UsersPage() {
  return (
    <PageGuard role="admin">
      <UsersContent />
    </PageGuard>
  );
}

function UsersContent() {
  const { me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("accounts");
  const { data: users, error, loading, reload } = useApiData<UserAccount[]>("/api/users");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"" | "active" | "locked" | "admin" | "user">("");
  const [form, setForm] = useState<{ user: UserAccount | null } | null>(null);
  const [pwUser, setPwUser] = useState<UserAccount | null>(null);

  const load = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  const stats = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      active: list.filter((u) => u.active).length,
      locked: list.filter((u) => !u.active).length,
      admins: list.filter((u) => u.role === "admin").length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const nq = normalizeText(q.trim());
    return (users ?? []).filter((u) => {
      if (filter === "active" && !u.active) return false;
      if (filter === "locked" && u.active) return false;
      if (filter === "admin" && u.role !== "admin") return false;
      if (filter === "user" && u.role === "admin") return false;
      return matchesQuery(nq, u.username, u.fullName, u.position);
    });
  }, [users, q, filter]);

  const actions: UserActions = {
    onEdit: (u) => setForm({ user: u }),
    onPassword: (u) => setPwUser(u),
    onToggleActive: async (u) => {
      if (u.active) {
        const ok = await confirm({
          title: `Khóa tài khoản ${u.username}?`,
          message: "Người dùng sẽ không thể đăng nhập cho đến khi được mở khóa.",
          confirmText: "Khóa tài khoản",
          danger: true,
        });
        if (!ok) return;
      }
      try {
        await api.patch(`/api/users/${u.id}/active`, { active: !u.active });
        toast.success(u.active ? `Đã khóa tài khoản ${u.username}.` : `Đã mở khóa tài khoản ${u.username}.`);
        await load();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    onDelete: async (u) => {
      const ok = await confirm({
        title: `Xóa tài khoản ${u.username}?`,
        message: (
          <>
            Tài khoản <b className="text-fg">{u.fullName || u.username}</b> sẽ bị xóa vĩnh viễn. Lịch sử thao tác cũ vẫn được giữ lại. Nếu chỉ muốn tạm
            ngừng, hãy dùng chức năng <b className="text-fg">Khóa</b>.
          </>
        ),
        confirmText: "Xóa tài khoản",
        danger: true,
      });
      if (!ok) return;
      try {
        await api.delete(`/api/users/${u.id}`);
        toast.success(`Đã xóa tài khoản ${u.username}.`);
        await load();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
  };

  return (
    <>
      <PageHeader
        title="Người dùng"
        description="Quản lý tài khoản, hồ sơ nhân viên và phân quyền truy cập."
        actions={
          tab === "accounts" ? (
            <>
              <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={load} aria-label="Làm mới">
                <span className="hidden sm:inline">Làm mới</span>
              </Button>
              <Button icon={UserPlus} onClick={() => setForm({ user: null })}>
                Tạo tài khoản
              </Button>
            </>
          ) : null
        }
      />

      {me?.isSuper ? (
        <Tabs<Tab>
          className="mb-5"
          value={tab}
          onChange={setTab}
          items={[
            { value: "accounts", label: "Tài khoản", count: users?.length },
            {
              value: "sessions",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <MonitorSmartphone size={14} /> Phiên đăng nhập
                </span>
              ),
            },
          ]}
        />
      ) : null}

      {tab === "sessions" && me?.isSuper ? (
        <LoginSessions />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Tổng tài khoản" value={users ? stats.total : "—"} icon={Users} />
            <StatCard label="Đang hoạt động" value={users ? stats.active : "—"} icon={UserCheck} tone="success" />
            <StatCard label="Đã khóa" value={users ? stats.locked : "—"} icon={UserX} tone="danger" />
            <StatCard label="Quản trị viên" value={users ? stats.admins : "—"} icon={ShieldCheck} tone="accent" />
          </div>

          <Card>
            <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <SearchInput className="sm:max-w-sm sm:flex-1" placeholder="Tìm theo tên, tài khoản, chức danh…" value={q} onChange={(e) => setQ(e.target.value)} />
              <Select className="sm:w-48" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Lọc tài khoản">
                <option value="">Tất cả tài khoản</option>
                <option value="active">Đang hoạt động</option>
                <option value="locked">Đã khóa</option>
                <option value="admin">Quản trị viên</option>
                <option value="user">Nhân viên</option>
              </Select>
              <p className="text-[13px] text-muted sm:ml-auto">
                {users ? (
                  <>
                    Hiển thị <span className="num font-medium text-fg">{filtered.length}</span> / <span className="num">{users.length}</span>
                  </>
                ) : null}
              </p>
            </div>
            {error && !users ? (
              <EmptyState
                icon={UserX}
                title="Không tải được danh sách tài khoản"
                description={error}
                action={
                  <Button variant="secondary" icon={RefreshCw} onClick={load}>
                    Thử lại
                  </Button>
                }
              />
            ) : !users ? (
              <Spinner />
            ) : !filtered.length ? (
              <EmptyState
                icon={Users}
                title={users.length ? "Không có tài khoản phù hợp" : "Chưa có tài khoản"}
                description={users.length ? "Thử đổi từ khóa hoặc bộ lọc." : "Tạo tài khoản đầu tiên cho nhân viên."}
                action={
                  users.length ? undefined : (
                    <Button icon={UserPlus} onClick={() => setForm({ user: null })}>
                      Tạo tài khoản
                    </Button>
                  )
                }
              />
            ) : (
              <UsersList users={filtered} meId={me?.id} actions={actions} />
            )}
          </Card>
          <p className="mt-3 text-xs text-muted">Tài khoản Super Admin không hiển thị và không thể chỉnh sửa tại đây.</p>
        </>
      )}

      {form ? <UserFormModal user={form.user} onClose={() => setForm(null)} onSaved={load} /> : null}
      {pwUser ? <PasswordModal user={pwUser} onClose={() => setPwUser(null)} /> : null}
    </>
  );
}
