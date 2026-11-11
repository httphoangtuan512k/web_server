"use client";
// File này: form tạo/sửa tài khoản (thông tin cơ bản bên trái, phân quyền bên phải, ảnh đại diện).
// Dùng ở: đầu trang Người dùng.

import { ImagePlus, Loader2 } from "lucide-react";
import { forwardRef, useId, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { uploadImage } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import { OgButton, OgCard, ogInput } from "../../_shared/og-button";
import { KHO_EDIT, MIN_PASSWORD, ORDER_PERMS, PAGE_PERMS, POSITION_SUGGESTIONS, USERNAME_RE } from "./constants";
import { orderPermsOf, type PermOption, type UserAccount, type UserPayload } from "./types";

// Dữ liệu các ô trong form (pages = quyền trang, khoEdit = quyền sửa kho).
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

// Giá trị ban đầu: trống khi tạo mới, lấy từ tài khoản khi sửa.
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

// Bật/tắt một quyền trong danh sách (không trùng lặp).
const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

/**
 * Form "Tạo tài khoản mới" / "Sửa tài khoản: …" nằm ngay trên trang như admin.html cũ:
 * cột trái thông tin cơ bản, cột phải phân quyền; nút "Tạo tài khoản"/"Lưu thay đổi" (navy) + "Hủy sửa".
 * Tạo mới: POST /api/users. Sửa: PATCH /api/users/:id (+ PUT …/password nếu nhập mật khẩu mới).
 */
export const AccountForm = forwardRef<HTMLElement, { user: UserAccount | null; onCancel: () => void; onSaved: () => void }>(function AccountForm(
  { user, onCancel, onSaved },
  ref,
) {
  // Hàm báo, mã id riêng cho các ô, chế độ sửa hay tạo.
  const toast = useToast();
  const uid = useId();
  const isEdit = !!user;
  // Dữ liệu form, trạng thái đang lưu, lỗi từng ô.
  const [f, setF] = useState<FormState>(() => initial(user));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const isAdmin = f.role === "admin";

  // Đổi giá trị một ô trong form.
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  function changeRole(role: "user" | "admin") {
    // Như trang cũ: Quản trị viên mặc định toàn quyền trang & đơn → bỏ tích các quyền này. Quyền sửa Kho giữ nguyên.
    setF((s) => (role === "admin" ? { ...s, role, permissions: [], pages: [] } : { ...s, role }));
  }

  // Kiểm tra dữ liệu nhập; trả true nếu hợp lệ, lỗi thì hiện dưới ô.
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

  // Bấm nút lưu: kiểm tra, gom dữ liệu, gửi máy chủ.
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    // Quản trị viên không cần tích quyền trang; quyền sửa kho luôn tính riêng.
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
      // Tạo mới → POST; sửa → PATCH (+ đổi mật khẩu nếu có nhập).
      if (!user) {
        await api.post("/api/users", { ...payload, username: f.username.trim(), password: f.password });
        toast.success(`Đã tạo tài khoản ${f.username.trim()}.`);
      } else {
        await api.patch(`/api/users/${user.id}`, { ...payload });
        if (f.password) await api.put(`/api/users/${user.id}/password`, { password: f.password });
        toast.success(f.password ? "Đã cập nhật hồ sơ và đổi mật khẩu." : "Đã cập nhật hồ sơ tài khoản.");
      }
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // Tạo id cho từng ô (gắn nhãn với ô nhập).
  const id = (k: string) => `${uid}-${k}`;
  const listId = id("positions");

  return (
    // Thẻ form; khi đang sửa có viền xanh nổi bật.
    <OgCard ref={ref} className={cn("scroll-mt-24", isEdit && "ring-2 ring-[#9bbbd2]/60")}>
      {/* Tiêu đề: "Tạo tài khoản mới" hoặc "Sửa tài khoản: …" */}
      <h2 className="mb-5 text-lg font-bold text-[#1e293b] sm:text-xl">{isEdit ? `Sửa tài khoản: ${user.username}` : "Tạo tài khoản mới"}</h2>

      <form onSubmit={submit} noValidate>
        {/* Hai cột trên máy tính, một cột trên điện thoại */}
        <div className="grid gap-x-6 md:grid-cols-2">
          {/* CỘT TRÁI: THÔNG TIN CƠ BẢN */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* Tên đăng nhập (khóa khi sửa) */}
            <OgField label="Tên đăng nhập *" htmlFor={id("username")} error={errors.username} help={isEdit ? "Không thể đổi tên đăng nhập." : undefined}>
              <input
                id={id("username")}
                className={ogInput}
                value={f.username}
                onChange={(e) => set("username", e.target.value)}
                disabled={isEdit}
                autoComplete="off"
                maxLength={30}
              />
            </OgField>
            {/* Mật khẩu (khi sửa: để trống = không đổi) */}
            <OgField label={isEdit ? "Mật khẩu mới (nếu có)" : "Mật khẩu *"} htmlFor={id("password")} error={errors.password} help={`Mật khẩu ít nhất ${MIN_PASSWORD} ký tự.`}>
              <input
                id={id("password")}
                type="password"
                className={ogInput}
                value={f.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete="new-password"
                maxLength={200}
                placeholder={isEdit ? "Để trống nếu không đổi" : ""}
              />
            </OgField>
            <OgField label="Họ và tên nhân viên *" htmlFor={id("fullName")} error={errors.fullName}>
              <input id={id("fullName")} className={ogInput} value={f.fullName} onChange={(e) => set("fullName", e.target.value)} maxLength={100} />
            </OgField>
            {/* Chức danh, có danh sách gợi ý */}
            <OgField label="Chức danh *" htmlFor={id("position")} error={errors.position}>
              <input id={id("position")} className={ogInput} value={f.position} onChange={(e) => set("position", e.target.value)} maxLength={100} list={listId} />
              <datalist id={listId}>
                {POSITION_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </OgField>
            {/* Vai trò: Nhân viên / Quản trị viên */}
            <OgField label="Quyền hệ thống *" htmlFor={id("role")}>
              <select id={id("role")} className={cn(ogInput, "pr-8")} value={f.role} onChange={(e) => changeRole(e.target.value === "admin" ? "admin" : "user")}>
                <option value="user">Nhân viên</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </OgField>
            <AvatarField value={f.avatar} onChange={(v) => set("avatar", v)} />
          </div>

          {/* CỘT PHẢI: PHÂN QUYỀN */}
          <div className="mt-5 flex min-w-0 flex-col gap-4 md:mt-0">
            {/* Quyền đơn hàng (mờ đi nếu là Quản trị viên) */}
            <PermBox
              title="Phân quyền tính năng (Trang Kế hoạch)"
              options={ORDER_PERMS}
              values={f.permissions}
              disabled={isAdmin}
              onToggle={(v, on) => set("permissions", toggle(f.permissions, v, on))}
            />
            {/* Quyền vào các trang */}
            <PermBox
              title="Phân quyền truy cập các trang (Dành cho Nhân viên)"
              options={PAGE_PERMS}
              values={f.pages}
              disabled={isAdmin}
              columns={2}
              help="Admin mặc định có quyền vào tất cả các trang."
              onToggle={(v, on) => set("pages", toggle(f.pages, v, on))}
            />
            {/* Quyền sửa dữ liệu Kho (tách riêng) */}
            <PermBox
              title="Phân quyền tính năng (Trang Kho)"
              options={[KHO_EDIT]}
              values={f.khoEdit ? [KHO_EDIT.value] : []}
              help="Quyền vào trang Kho và quyền chỉnh sửa được tách riêng. Chỉ Super Admin hoặc tài khoản được tích mục này mới được thay đổi dữ liệu Kho."
              onToggle={(_, on) => set("khoEdit", on)}
            />
          </div>
        </div>

        {/* Nút lưu và nút "Hủy sửa" */}
        <div className="mt-6 flex flex-wrap gap-2">
          <OgButton type="submit" variant="primary" disabled={saving}>
            {saving ? "Đang xử lý..." : isEdit ? "Lưu thay đổi" : "Tạo tài khoản"}
          </OgButton>
          {isEdit ? (
            <OgButton onClick={onCancel} disabled={saving}>
              Hủy sửa
            </OgButton>
          ) : null}
        </div>
      </form>
    </OgCard>
  );
});

// Một ô form: nhãn, ô nhập, dòng lỗi (đỏ) hoặc gợi ý (xám).
function OgField({ label, htmlFor, error, help, children }: { label: string; htmlFor: string; error?: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-[7px] block text-sm font-semibold text-[#1e293b]">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-[#b42318]">{error}</p> : help ? <p className="mt-1.5 text-xs text-[#64748b]">{help}</p> : null}
    </div>
  );
}

// Nhóm ô tích chọn quyền, có tiêu đề và dòng gợi ý; disabled thì mờ và khóa.
function PermBox({
  title,
  options,
  values,
  disabled,
  columns = 1,
  help,
  onToggle,
}: {
  title: string;
  options: PermOption[];
  values: string[];
  disabled?: boolean;
  columns?: 1 | 2;
  help?: string;
  onToggle: (value: string, on: boolean) => void;
}) {
  return (
    <fieldset className={cn("min-w-0 transition-opacity", disabled && "opacity-40")} disabled={disabled}>
      <legend className="mb-[7px] text-sm font-semibold text-[#1e293b]">{title}</legend>
      <div className={cn("grid gap-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-[15px]", columns === 2 && "min-[420px]:grid-cols-2")}>
        {/* Mỗi quyền một ô tích */}
        {options.map((o) => (
          <label key={o.value} className="flex min-w-0 cursor-pointer items-center gap-2 text-sm text-[#1e293b] select-none">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 cursor-pointer accent-[#172b3a]"
              checked={values.includes(o.value)}
              onChange={(e) => onToggle(o.value, e.target.checked)}
            />
            <span className="min-w-0">{o.label}</span>
          </label>
        ))}
      </div>
      {help ? <p className="mt-1.5 text-xs leading-relaxed text-[#64748b]">{help}</p> : null}
    </fieldset>
  );
}

/** Ảnh đại diện: chọn ảnh → nén → tải lên (như ImageInput), xem trước hình tròn 76px như trang cũ. */
function AvatarField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Chọn file: tải ảnh lên, lưu đường dẫn; xong thì xóa lựa chọn trong ô file.
  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file, "avatars"));
    } catch (e) {
      toast.error(`Không tải được ảnh: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="min-w-0">
      {/* Nhãn "Ảnh đại diện" */}
      <span className="mb-[7px] block text-sm font-semibold text-[#1e293b]">Ảnh đại diện</span>
      <div className="flex min-h-[42px] flex-wrap items-center gap-3 rounded-md border border-[#cbd5e1] bg-white p-2">
        {/* Ảnh xem trước (bấm để mở to) */}
        {value ? (
          <a href={value} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Xem trước ảnh đại diện" className="h-[76px] w-[76px] rounded-full border border-[#dce3e9] bg-[#eaf1f6] object-cover" />
          </a>
        ) : null}
        {/* Ô chọn file ẩn, mở bằng nút "Chọn ảnh" */}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {/* Nút Chọn/Đổi ảnh và Gỡ ảnh */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <OgButton size="sm" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {busy ? "Đang tải lên…" : value ? "Đổi ảnh" : "Chọn ảnh"}
          </OgButton>
          {value ? (
            <OgButton size="sm" variant="danger" onClick={() => onChange("")} disabled={busy}>
              Gỡ ảnh
            </OgButton>
          ) : (
            <span className="text-sm text-[#64748b]">Chưa chọn ảnh</span>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-[#64748b]">Chọn JPEG, PNG hoặc WebP – ảnh được tự động nén trước khi tải lên.</p>
    </div>
  );
}
