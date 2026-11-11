"use client";

import { Save, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { ImageInput } from "@/components/ui/image-input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { KHO_EDIT, MIN_PASSWORD, ORDER_PERMS, PAGE_PERMS, POSITION_SUGGESTIONS, USERNAME_RE } from "./constants";
import { orderPermsOf, type PermOption, type UserAccount, type UserPayload } from "./types";

interface FormState {
  username: string;
  password: string;
  fullName: string;
  position: string;
  role: "user" | "admin";
  avatar: string;
  permissions: string[];
  pages: string[];
  khoEdit: boolean;
}

function initial(user: UserAccount | null): FormState {
  if (!user) return { username: "", password: "", fullName: "", position: "", role: "user", avatar: "", permissions: [], pages: [], khoEdit: false };
  const pages = user.pagePermissions || [];
  return {
    username: user.username,
    password: "",
    fullName: user.fullName || "",
    position: user.position || "",
    role: user.role === "admin" ? "admin" : "user",
    avatar: user.avatar || "",
    permissions: [...orderPermsOf(user)],
    pages: pages.filter((p) => p !== KHO_EDIT.value),
    khoEdit: pages.includes(KHO_EDIT.value),
  };
}

const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

/** Tạo mới (user = null) hoặc sửa tài khoản. */
export function UserFormModal({ user, onClose, onSaved }: { user: UserAccount | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const listId = useId();
  const isEdit = !!user;
  const [f, setF] = useState<FormState>(() => initial(user));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const isAdmin = f.role === "admin";

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  function changeRole(role: "user" | "admin") {
    // Như trang cũ: Quản trị viên mặc định toàn quyền trang & đơn → bỏ tích các quyền này. Quyền sửa Kho giữ nguyên.
    setF((s) => (role === "admin" ? { ...s, role, permissions: [], pages: [] } : { ...s, role }));
  }

  function validate() {
    const e: typeof errors = {};
    if (!isEdit && !USERNAME_RE.test(f.username.trim())) e.username = "3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới, gạch ngang.";
    if (!isEdit && f.password.length < MIN_PASSWORD) e.password = `Mật khẩu ít nhất ${MIN_PASSWORD} ký tự.`;
    if (isEdit && f.password && f.password.length < MIN_PASSWORD) e.password = `Mật khẩu mới ít nhất ${MIN_PASSWORD} ký tự (hoặc để trống nếu không đổi).`;
    if (!f.fullName.trim()) e.fullName = "Vui lòng nhập họ và tên.";
    if (!f.position.trim()) e.position = "Vui lòng nhập chức danh.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const pagePermissions = isAdmin ? [] : [...f.pages];
    if (f.khoEdit) pagePermissions.push(KHO_EDIT.value);
    const payload: UserPayload = {
      fullName: f.fullName.trim(),
      position: f.position.trim(),
      role: f.role,
      avatar: f.avatar,
      permissions: isAdmin ? [] : f.permissions,
      pagePermissions,
    };
    try {
      if (!user) {
        await api.post("/api/users", { ...payload, username: f.username.trim(), password: f.password });
        toast.success(`Đã tạo tài khoản ${f.username.trim()}.`);
      } else {
        await api.patch(`/api/users/${user.id}`, { ...payload });
        if (f.password) await api.put(`/api/users/${user.id}/password`, { password: f.password });
        toast.success(f.password ? "Đã cập nhật hồ sơ và đổi mật khẩu." : "Đã cập nhật hồ sơ tài khoản.");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const formId = `user-form-${listId}`;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? `Sửa tài khoản: ${user.username}` : "Tạo tài khoản mới"}
      description={isEdit ? "Cập nhật hồ sơ nhân viên và phân quyền." : "Thông tin đăng nhập, hồ sơ nhân viên và phân quyền truy cập."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" form={formId} loading={saving} icon={isEdit ? Save : UserPlus}>
            {isEdit ? "Lưu thay đổi" : "Tạo tài khoản"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Hồ sơ */}
        <section className="flex flex-col gap-4">
          <SectionTitle>Thông tin tài khoản</SectionTitle>
          <Field label="Ảnh đại diện">
            <ImageInput value={f.avatar} onChange={(v) => set("avatar", v)} folder="avatars" label="Chọn ảnh" />
          </Field>
          <Field label="Tên đăng nhập" required error={errors.username} hint={isEdit ? "Không thể đổi tên đăng nhập." : undefined}>
            <Input
              value={f.username}
              onChange={(e) => set("username", e.target.value)}
              disabled={isEdit}
              autoComplete="off"
              maxLength={30}
              placeholder="vd: nguyenvana"
              autoFocus={!isEdit}
            />
          </Field>
          <Field
            label={isEdit ? "Mật khẩu mới" : "Mật khẩu"}
            required={!isEdit}
            error={errors.password}
            hint={isEdit ? "Để trống nếu không đổi." : `Ít nhất ${MIN_PASSWORD} ký tự.`}
          >
            <Input
              type="password"
              value={f.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              maxLength={200}
              placeholder={isEdit ? "Để trống nếu không đổi" : ""}
            />
          </Field>
          <Field label="Họ và tên nhân viên" required error={errors.fullName}>
            <Input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} maxLength={100} autoFocus={isEdit} />
          </Field>
          <Field label="Chức danh" required error={errors.position}>
            <Input value={f.position} onChange={(e) => set("position", e.target.value)} maxLength={100} list={listId} placeholder="Chọn hoặc nhập" />
            <datalist id={listId}>
              {POSITION_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Vai trò hệ thống" required>
            <Select value={f.role} onChange={(e) => changeRole(e.target.value === "admin" ? "admin" : "user")}>
              <option value="user">Nhân viên</option>
              <option value="admin">Quản trị viên</option>
            </Select>
          </Field>
        </section>

        {/* Phân quyền */}
        <section className="flex flex-col gap-4">
          <SectionTitle>Phân quyền</SectionTitle>
          {isAdmin ? (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-[13px] text-brand-700">
              Quản trị viên mặc định có quyền vào tất cả các trang và mọi thao tác đơn hàng.
            </p>
          ) : null}
          <PermGroup
            title="Truy cập trang"
            hint="Dành cho Nhân viên."
            options={PAGE_PERMS}
            values={f.pages}
            disabled={isAdmin}
            onToggle={(v, on) => set("pages", toggle(f.pages, v, on))}
          />
          <PermGroup
            title="Thao tác đơn hàng (Kế hoạch / Vận hành)"
            options={ORDER_PERMS}
            values={f.permissions}
            disabled={isAdmin}
            onToggle={(v, on) => set("permissions", toggle(f.permissions, v, on))}
          />
          <PermGroup
            title="Dữ liệu Kho"
            hint="Quyền vào trang Kho và quyền sửa được tách riêng. Chỉ Super Admin hoặc tài khoản được tích mục này mới được thay đổi dữ liệu Kho (áp dụng cả với Quản trị viên)."
            options={[KHO_EDIT]}
            values={f.khoEdit ? [KHO_EDIT.value] : []}
            onToggle={(_, on) => set("khoEdit", on)}
          />
        </section>
      </form>
    </Modal>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="border-b border-line pb-2 text-xs font-semibold tracking-wide text-muted uppercase">{children}</h3>;
}

function PermGroup({
  title,
  hint,
  options,
  values,
  disabled,
  onToggle,
}: {
  title: string;
  hint?: string;
  options: PermOption[];
  values: string[];
  disabled?: boolean;
  onToggle: (value: string, on: boolean) => void;
}) {
  return (
    <fieldset className={cn("rounded-xl border border-line bg-surface-2 p-3.5 transition-opacity", disabled && "opacity-50")} disabled={disabled}>
      <legend className="px-1 text-[13px] font-medium text-fg">{title}</legend>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.map((o) => (
          <Checkbox key={o.value} label={o.label} checked={values.includes(o.value)} onChange={(e) => onToggle(o.value, e.target.checked)} />
        ))}
      </div>
      {hint ? <p className="mt-2.5 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </fieldset>
  );
}
