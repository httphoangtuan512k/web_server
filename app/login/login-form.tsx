"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await api.post<{ redirect: string }>("/api/login", { username: username.trim(), password });
      const next = params?.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : r.redirect || "/";
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <Field label="Tên đăng nhập" htmlFor="username">
        <Input id="username" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
      </Field>
      <Field label="Mật khẩu" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-subtle hover:text-fg"
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </Field>
      {error ? <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full" loading={busy} icon={LogIn}>
        Đăng nhập
      </Button>
    </form>
  );
}
