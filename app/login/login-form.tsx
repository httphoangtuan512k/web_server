"use client";

import { Eye, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";

/** Form đăng nhập: ô gạch chân và nút viền đen như bản gốc. */
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

  const field =
    "w-full border-0 border-b-2 border-[#1f2937] bg-transparent px-1 pt-3 pb-2 text-base text-[#111827] outline-none transition-colors focus:border-[#244d68] focus-visible:outline-none";

  return (
    <form id="loginForm" onSubmit={submit} className="mt-8 space-y-6">
      <div>
        <label htmlFor="username" className="text-[15px] font-bold text-[#111827]">
          Tài Khoản
        </label>
        <input id="username" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor="password" className="text-[15px] font-bold text-[#111827]">
          Mật Khẩu
        </label>
        <div className="relative">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${field} pr-9`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-0 bottom-2 rounded p-1 text-[#64748b] hover:text-[#111827]"
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>
      {error ? (
        <p id="message" role="alert" className="rounded-md bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="h-[54px] w-full rounded-md border-2 border-[#1f2937] bg-white text-base font-bold text-[#111827] transition hover:bg-[#1f2937] hover:text-white disabled:opacity-60"
      >
        {busy ? "Đang đăng nhập…" : "Đăng Nhập"}
      </button>
    </form>
  );
}
