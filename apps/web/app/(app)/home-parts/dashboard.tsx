"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/format";
import { canSee, NAV } from "@/lib/nav";
import { Card, PageHeader } from "@/components/ui/card";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "numeric", hour12: false }).format(new Date()));
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

export function Dashboard() {
  const { me } = useAuth();
  const modules = NAV.filter((n) => n.href !== "/" && canSee(n, me));
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${me?.fullName ?? ""}`}
        description={`Hôm nay ${fmtDate(new Date())} · ${me?.isSuper ? "Super Admin" : me?.position ?? ""}`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.href} href={m.href} className="group">
              <Card className={cn("h-full p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-brand-200 group-hover:shadow-pop", m.soon && "opacity-75")}>
                <div className="flex items-start justify-between">
                  <span className={cn("grid h-11 w-11 place-items-center rounded-xl", m.group === "admin" ? "bg-accent-50 text-accent-600" : "bg-brand-50 text-brand-600")}>
                    <Icon size={21} />
                  </span>
                  <ArrowUpRight size={18} className="text-subtle transition-colors group-hover:text-brand-600" />
                </div>
                <p className="mt-4 font-semibold text-fg">
                  {m.label}
                  {m.soon ? <span className="ml-2 rounded bg-surface-3 px-1.5 py-0.5 align-middle text-[11px] font-medium text-muted">Sắp có</span> : null}
                </p>
                <p className="mt-1 text-[13px] text-muted">{m.description}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
