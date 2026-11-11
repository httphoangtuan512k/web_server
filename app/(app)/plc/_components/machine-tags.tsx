"use client";

import { formatPlcValue, PLC_MACHINES } from "../../van-hanh/_shared/plc";
import type { PlcLatestResponse } from "./types";

/** Lưới giá trị tag realtime của 4 máy (machines.may1..may4) – như .machines/.machine/.value của trang cũ. */
export function MachineTags({ latest, query, loading }: { latest: PlcLatestResponse | null; query: string; loading: boolean }) {
  const q = query.trim().toLocaleLowerCase("vi-VN");
  return (
    <div className="grid grid-cols-1 gap-3.5 min-[651px]:grid-cols-2 min-[1001px]:grid-cols-4">
      {PLC_MACHINES.map(({ id, label }) => {
        const data = latest?.payload?.machines?.[id] ?? {};
        const all = Object.entries(data);
        const entries = q ? all.filter(([name]) => name.toLocaleLowerCase("vi-VN").includes(q)) : all;
        return (
          <section key={id} className="min-w-0 rounded-xl border border-[#dbe3ed] bg-white p-3 shadow-[0_2px_8px_#0f172a0a] sm:p-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[#1e3a8a]">{label}</h2>
              <span className="num text-[13px] text-[#64748b]">{q ? `${entries.length}/${all.length}` : all.length} thông số</span>
            </div>
            {loading ? (
              <div className="rounded-lg bg-[#f8fafc] p-5 text-center text-[#64748b]">Đang tải dữ liệu {label.toLowerCase()}...</div>
            ) : !all.length ? (
              <div className="rounded-lg bg-[#f8fafc] p-5 text-center text-[#64748b]">Chưa có dữ liệu từ máy này.</div>
            ) : !entries.length ? (
              <div className="rounded-lg bg-[#f8fafc] p-5 text-center text-[#64748b]">Không có tag khớp bộ lọc.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {entries.map(([name, value]) => (
                  <div key={name} className="min-w-0 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-[9px] transition-colors hover:border-[#bfdbfe] hover:bg-[#f1f7ff]">
                    <div className="text-xs [overflow-wrap:anywhere] text-[#64748b]" title={name}>
                      {name}
                    </div>
                    <div className="num mt-[5px] text-base font-bold [overflow-wrap:anywhere] text-[#172033]">{formatPlcValue(value)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
