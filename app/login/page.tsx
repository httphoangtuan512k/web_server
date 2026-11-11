/**
 * File này: trang /login – thẻ trắng giữa màn hình có logo tròn và form đăng nhập.
 * Dùng ở: người chưa đăng nhập được chuyển tới đây.
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

// Tiêu đề tab trình duyệt.
export const metadata: Metadata = { title: "Đăng nhập" };

/** Đăng nhập – giữ bố cục bản gốc (logo tròn ở giữa, ô Tài Khoản / Mật Khẩu, nút Đăng Nhập) trong khung hiện đại. */
export default function LoginPage() {
  return (
    // Nền xám-xanh nhạt, nội dung căn giữa màn hình.
    <div className="grid min-h-dvh place-items-center bg-[linear-gradient(160deg,#f3f5f8_0%,#e8eef5_100%)] px-4 py-10">
      {/* Thẻ trắng bo góc, rộng tối đa 400px. */}
      <div className="w-full max-w-[400px] rounded-2xl border border-[#e2e8f0] bg-white px-6 py-9 shadow-[0_18px_45px_-20px_rgba(23,43,58,0.35)] sm:px-10">
        {/* Logo tròn SUPER WHITE. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="SUPER WHITE" className="mx-auto h-32 w-32 rounded-full border-2 border-[#1f2937] bg-white object-contain p-1.5 sm:h-[156px] sm:w-[156px]" />
        <p className="mt-4 text-center text-xs font-semibold tracking-[0.18em] text-[#64748b]">HỆ THỐNG QUẢN LÝ SẢN XUẤT</p>
        {/* Form đăng nhập (Suspense vì form đọc tham số ?next= trên URL). */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
