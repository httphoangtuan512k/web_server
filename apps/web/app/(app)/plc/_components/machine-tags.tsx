"use client";

import { Cpu, SearchX } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { formatPlcValue, PLC_MACHINES } from "../../van-hanh/_shared/plc";
import type { PlcLatestResponse } from "./types";

/** Lưới giá trị tag realtime của 4 máy (machines.may1..may4). */
export function MachineTags({ latest, query, loading }: { latest: PlcLatestResponse | null; query: string; loading: boolean }) {
  const q = query.trim().toLocaleLowerCase("vi-VN");
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {PLC_MACHINES.map(({ id, label }) => {
        const data = latest?.payload?.machines?.[id] ?? {};
        const all = Object.entries(data);
        const entries = q ? all.filter(([name]) => name.toLocaleLowerCase("vi-VN").includes(q)) : all;
        return (
          <Card key={id} className="flex min-w-0 flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h3 className="flex items-center gap-2 font-semibold text-fg">
                <Cpu size={16} className="text-brand-600" />
                {label}
                <span className="font-mono text-xs font-normal text-subtle">{id}</span>
              </h3>
              <Badge tone={all.length ? "brand" : "neutral"}>
                <span className="num">{q ? `${entries.length}/${all.length}` : all.length}</span> thông số
              </Badge>
            </div>
            {loading ? (
              <p className="p-6 text-center text-sm text-muted">Đang tải dữ liệu {label.toLowerCase()}…</p>
            ) : !all.length ? (
              <EmptyState icon={Cpu} title="Chưa có dữ liệu từ máy này." />
            ) : !entries.length ? (
              <EmptyState icon={SearchX} title="Không có tag khớp bộ lọc." />
            ) : (
              <div className="grid grid-cols-2 gap-2 p-3">
                {entries.map(([name, value]) => (
                  <div key={name} className="min-w-0 rounded-lg border border-line bg-surface-2 px-3 py-2">
                    <p className="text-[11px] leading-snug break-words text-muted" title={name}>
                      {name}
                    </p>
                    <p className="num mt-1 text-[15px] font-semibold break-words text-fg">{formatPlcValue(value)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
