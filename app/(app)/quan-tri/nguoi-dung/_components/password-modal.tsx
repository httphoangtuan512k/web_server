"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { OgButton } from "../../_shared/og-button";
import { MIN_PASSWORD } from "./constants";
import type { UserAccount } from "./types";

/** Đổi mật khẩu: PUT /api/users/:id/password { password }. */
export function PasswordModal({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD) return setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự.`);
    if (pw !== pw2) return setError("Mật khẩu nhập lại không khớp.");
    setError("");
    setSaving(true);
    try {
      await api.put(`/api/users/${user.id}/password`, { password: pw });
      toast.success(`Đã đổi mật khẩu cho ${user.username}.`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Đổi mật khẩu cho ${user.username}`}
      description={`${user.fullName || user.username} · mật khẩu mới ít nhất ${MIN_PASSWORD} ký tự.`}
      footer={
        <>
          <OgButton onClick={onClose} disabled={saving}>
            Hủy
          </OgButton>
          <OgButton type="submit" form="password-form" variant="primary" loading={saving}>
            Đổi mật khẩu
          </OgButton>
        </>
      }
    >
      <form id="password-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Mật khẩu mới" required hint={`Ít nhất ${MIN_PASSWORD} ký tự.`}>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" maxLength={200} autoFocus />
        </Field>
        <Field label="Nhập lại mật khẩu" required error={error}>
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" maxLength={200} />
        </Field>
      </form>
    </Modal>
  );
}
