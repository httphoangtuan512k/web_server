"use client";

import { ChevronsUpDown, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { canSee, NAV } from "@/lib/nav";
import { ConfirmProvider } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/card";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Shell>{children}</Shell>
      </ConfirmProvider>
    </AuthProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh lg:pl-[260px]">
      {/* Sidebar */}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-sidebar text-sidebar-fg transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0 shadow-pop" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" />
          <div className="min-w-0 leading-tight">
            <p className="text-[15px] font-semibold tracking-wide text-white">SUPER WHITE</p>
            <p className="text-[11px] text-sidebar-fg/70">Quản lý sản xuất</p>
          </div>
          <button className="ml-auto rounded-md p-1 text-sidebar-fg hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Đóng menu">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavGroup group="main" />
          <NavGroup group="admin" title="Quản trị" />
        </nav>
        <UserCard />
      </aside>
      {open ? <div className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)} /> : null}

      {/* Topbar mobile */}
      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="-ml-1 rounded-lg p-2 text-fg hover:bg-surface-3" aria-label="Mở menu">
          <Menu size={20} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="" className="h-7 w-7 rounded-md object-contain" />
        <span className="font-semibold">SUPER WHITE</span>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {loading ? <Spinner /> : me ? children : <Spinner label="Đang chuyển tới trang đăng nhập…" />}
      </main>
    </div>
  );
}

function NavGroup({ group, title }: { group: "main" | "admin"; title?: string }) {
  const { me } = useAuth();
  const pathname = usePathname();
  const items = NAV.filter((n) => n.group === group && canSee(n, me));
  if (!items.length) return null;
  return (
    <div className="mt-2">
      {title ? <p className="px-3 pt-4 pb-2 text-[11px] font-semibold tracking-wider text-sidebar-fg/50 uppercase">{title}</p> : null}
      <ul className="space-y-0.5">
        {items.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
                  active ? "bg-sidebar-active text-white" : "text-sidebar-fg hover:bg-white/8 hover:text-white",
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span className="truncate">{it.label}</span>
                {it.soon ? <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-sidebar-fg/80">Sắp có</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UserCard() {
  const { me, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const saved = (() => {
      try {
        return localStorage.getItem("sw-theme");
      } catch {
        return null;
      }
    })();
    if (saved) document.documentElement.dataset.theme = saved;
    setDark(saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sw-theme", next);
    } catch {}
    setDark(!dark);
  };
  if (!me) return null;
  const initials = (me.fullName || me.username)
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="relative border-t border-white/10 p-3">
      {menu ? (
        <div className="absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-xl border border-line bg-surface text-fg shadow-pop">
          <button onClick={toggleTheme} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-surface-3">
            {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? "Giao diện sáng" : "Giao diện tối"}
          </button>
          <button onClick={logout} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-danger-600 hover:bg-danger-50">
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      ) : null}
      <button onClick={() => setMenu((v) => !v)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/8">
        {me.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-500 text-[13px] font-semibold text-white">{initials}</span>
        )}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-semibold text-white">{me.fullName}</span>
          <span className="block truncate text-[11.5px] text-sidebar-fg/70">{me.isSuper ? "Super Admin" : me.position}</span>
        </span>
        <ChevronsUpDown size={15} className="text-sidebar-fg/60" />
      </button>
    </div>
  );
}
