"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PageGuard } from "@/components/shell/page-guard";
import { PageBody, PageTopbar, TopbarButton, TopbarLink } from "@/components/shell/page-topbar";
import { OgButton, OgCard, OgCardTitle, OgEmptyBox, ogInput, OgScreen, topbarStack } from "../../_shared/og-button";
import { useApiData } from "../../_shared/use-api-data";
import { matchesQuery, normalizeText } from "../../_shared/utils";
import { AccountForm } from "./account-form";
import { LoginSessions } from "./login-sessions";
import { PasswordModal } from "./password-modal";
import type { UserAccount } from "./types";
import { UsersList, type UserActions } from "./users-list";

/** Nút trên thanh tiêu đề trang Quản lý nhân sự: nền trắng chữ tối như admin.html cũ. */
const whiteTopbarBtn = "max-sm:px-2.5! max-sm:text-[13px]! border-[#cbd5e1]! bg-white! font-normal! text-[#1e293b]! hover:bg-[#edf2f6]!";

export function UsersPage() {
  return (
    <OgScreen>
      <PageGuard role="admin">
        <UsersContent />
      </PageGuard>
    </OgScreen>
  );
}

function UsersContent() {
  const { me, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: users, error, loading, reload } = useApiData<UserAccount[]>("/api/users");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"" | "active" | "locked" | "admin" | "user">("");
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pwUser, setPwUser] = useState<UserAccount | null>(null);
  const formRef = useRef<HTMLElement>(null);

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

  const resetForm = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
  };

  const actions: UserActions = {
    onEdit: (u) => {
      setEditing(u);
      setFormKey((k) => k + 1);
      requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    },
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
        if (editing?.id === u.id) resetForm();
        await load();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
  };

  return (
    <>
      <PageTopbar
        title="SUPER WHITE"
        subtitle="QUẢN LÝ TÀI KHOẢN VÀ HỒ SƠ NHÂN VIÊN"
        backHref={null}
        className={topbarStack}
                actions={
          <>
            <TopbarLink href="/" className={whiteTopbarBtn}>
              ← Trang chủ
            </TopbarLink>
            {me?.isSuper ? (
              <TopbarLink href="/quan-tri/du-lieu" className={whiteTopbarBtn}>
                Chỉnh sửa dữ liệu
              </TopbarLink>
            ) : null}
            <TopbarButton onClick={logout} className={whiteTopbarBtn}>
              Đăng xuất
            </TopbarButton>
          </>
        }
      />

      <PageBody className="flex max-w-[1250px]! flex-col gap-4 sm:gap-5">
        <AccountForm
          key={`${editing?.id ?? "new"}-${formKey}`}
          ref={formRef}
          user={editing}
          onCancel={resetForm}
          onSaved={() => {
            resetForm();
            void load();
          }}
        />

        <OgCard>
          <OgCardTitle
            title="Danh sách tài khoản"
            help={
              users ? (
                <>
                  {stats.total} tài khoản · <span className="text-[#16794b]">{stats.active} hoạt động</span> ·{" "}
                  <span className={cn(stats.locked && "text-[#b42318]")}>{stats.locked} đã khóa</span> · {stats.admins} quản trị viên. Tài khoản Super Admin
                  không hiển thị và không thể chỉnh sửa tại đây.
                </>
              ) : null
            }
            actions={
              <OgButton loading={loading} onClick={load}>
                Làm mới
              </OgButton>
            }
            className="mb-3.5!"
          />
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              className={cn(ogInput, "min-h-10! sm:max-w-sm")}
              placeholder="Tìm theo tên, tài khoản, chức danh…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className={cn(ogInput, "min-h-10! sm:w-48")} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Lọc tài khoản">
              <option value="">Tất cả tài khoản</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Đã khóa</option>
              <option value="admin">Quản trị viên</option>
              <option value="user">Nhân viên</option>
            </select>
            {users && filtered.length !== users.length ? (
              <p className="text-[13px] text-[#64748b] sm:ml-auto">
                Hiển thị <b className="text-[#1e293b]">{filtered.length}</b> / {users.length}
              </p>
            ) : null}
          </div>

          {error && !users ? (
            <OgEmptyBox tone="error">{error}</OgEmptyBox>
          ) : !users ? (
            <OgEmptyBox>Đang tải dữ liệu...</OgEmptyBox>
          ) : !filtered.length ? (
            <OgEmptyBox>{users.length ? "Không có tài khoản phù hợp." : "Chưa có tài khoản."}</OgEmptyBox>
          ) : (
            <UsersList users={filtered} meId={me?.id} actions={actions} />
          )}
        </OgCard>

        {me?.isSuper ? <LoginSessions /> : null}

        <p className="pb-2 text-center text-xs text-[#64748b]">
          Xem thêm:{" "}
          <Link href="/quan-tri/nhat-ky" className="font-semibold text-[#244d68] hover:underline">
            Lịch sử hoạt động
          </Link>
          {me?.isSuper ? (
            <>
              {" · "}
              <Link href="/quan-tri/he-thong" className="font-semibold text-[#244d68] hover:underline">
                Kết nối PLC &amp; sao lưu
              </Link>
            </>
          ) : null}
        </p>
      </PageBody>

      {pwUser ? <PasswordModal user={pwUser} onClose={() => setPwUser(null)} /> : null}
    </>
  );
}
