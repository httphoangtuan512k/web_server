"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { canSee, NAV, type NavItem } from "@/lib/nav";

/** Trang chủ – giống trang chủ cũ (trangchu.html): thanh navy, lời chào, lưới thẻ chức năng. */
export function Dashboard() {
  const { me, logout } = useAuth();
  const main = NAV.filter((n) => n.group === "main" && canSee(n, me));
  const admin = NAV.filter((n) => n.group === "admin" && canSee(n, me));
  const name = me?.fullName || me?.username || "";
  const initial = (name.trim()[0] || "U").toUpperCase();

  return (
    <div className="min-h-dvh bg-[#f3f5f8] text-[#1e293b]">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[#172b3a] px-4 py-3.5 text-white shadow-[0_3px_12px_rgba(0,0,0,0.12)] sm:px-8 sm:py-4">
        <div className="flex min-w-0 items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Logo SUPER WHITE" className="h-11 w-11 shrink-0 rounded-full bg-white object-contain sm:h-[54px] sm:w-[54px]" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-[1px] sm:text-[21px]">SUPER WHITE</h1>
            <p className="text-[9px] tracking-[0.5px] text-white/80 sm:text-[11px]">HỆ THỐNG QUẢN LÝ SẢN XUẤT</p>
          </div>
        </div>
        <div className="flex w-full items-center gap-3 border-t border-[#435563] pt-3 sm:w-auto sm:border-0 sm:pt-0">
          {me?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover sm:h-12 sm:w-12" />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e2e8f0] text-lg font-bold text-[#172b3a] sm:h-12 sm:w-12">{initial}</span>
          )}
          <div className="min-w-0 flex-1 sm:max-w-[200px]">
            <strong className="block truncate text-[13px] sm:text-sm">{name}</strong>
            <span className="block truncate text-[11px] text-white/75 sm:text-xs">{me?.isSuper ? "Super Admin" : me?.position}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="min-h-9 shrink-0 rounded-md border border-[#cbd5e1] px-3 py-2 text-xs whitespace-nowrap transition hover:bg-white hover:text-[#172b3a] sm:min-h-10 sm:text-[13px]"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-3.5 py-6 sm:px-7 sm:py-9">
        <section className="mb-6 sm:mb-8">
          <h2 className="text-2xl font-bold sm:text-[27px]">Trang chủ</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#64748b] sm:text-[15px]">Chào mừng bạn đến với hệ thống quản lý sản xuất SUPER WHITE.</p>
        </section>

        <h3 className="mb-4 text-base font-bold sm:text-lg">Danh mục chức năng</h3>
        <CardGrid items={main} />

        {admin.length ? (
          <>
            <h3 className="mt-8 mb-4 text-base font-bold sm:text-lg">Quản trị hệ thống</h3>
            <CardGrid items={admin} />
          </>
        ) : null}

        <footer className="mt-9 border-t border-[#e2e8f0] pt-5 text-center text-xs leading-relaxed text-[#94a3b8]">
          SUPER WHITE © Hệ thống quản lý sản xuất
          <br />
          Quản lý đơn hàng · Vận hành · KCS · Kho · Bảo trì
        </footer>
      </main>
    </div>
  );
}

function CardGrid({ items }: { items: NavItem[] }) {
  return (
    <section className="grid grid-cols-1 gap-3 min-[351px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
      {items.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className="flex min-h-[170px] min-w-0 flex-col items-start rounded-[10px] border border-[#e2e8f0] bg-white p-3.5 text-[#1e293b] shadow-[0_3px_10px_rgba(15,23,42,0.035)] transition hover:-translate-y-[3px] hover:border-[#9bb3c5] hover:shadow-[0_9px_22px_rgba(15,23,42,0.08)] sm:min-h-[205px] sm:rounded-xl sm:p-[23px]"
        >
          <span className="mb-3 grid h-10 w-10 place-items-center rounded-[11px] bg-[#eaf1f6] text-[22px] text-[#244d68] sm:mb-4 sm:h-[49px] sm:w-[49px] sm:text-[26px]">{m.icon}</span>
          <h3 className="mb-2 text-sm leading-snug font-bold sm:text-[17px]">{m.label}</h3>
          <p className="text-xs leading-relaxed text-[#64748b] sm:text-sm">{m.description}</p>
          <span className="mt-auto pt-3.5 text-xs font-bold text-[#244d68] sm:pt-[18px] sm:text-sm">Mở chức năng →</span>
        </Link>
      ))}
    </section>
  );
}
