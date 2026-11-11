import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Bảng thương hiệu */}
      <section className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-[520px] w-[520px] rotate-12 opacity-[0.12]"
          style={{ background: "conic-gradient(from 200deg, #ffffff, transparent 30%, #e0874e 45%, transparent 60%)" }}
        />
        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1" />
          <div>
            <p className="text-lg font-semibold tracking-wide">SUPER WHITE</p>
            <p className="text-sm text-white/60">Calcium Carbonate</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-[34px] leading-tight font-semibold tracking-tight">Điều hành sản xuất bột đá trắng, trên một màn hình.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Kế hoạch đơn hàng, vận hành máy nghiền, giám sát PLC, kho và bảo trì – đồng bộ theo thời gian thực cho toàn nhà máy.
          </p>
        </div>
        <p className="relative text-xs text-white/40">© SUPER WHITE · Calcium Carbonate</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="" className="h-11 w-11 rounded-xl object-contain" />
            <p className="text-lg font-semibold">SUPER WHITE</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Đăng nhập</h2>
          <p className="mt-1.5 text-sm text-muted">Dùng tài khoản được quản trị viên cấp.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
