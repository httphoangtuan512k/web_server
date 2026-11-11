"use client";
// File này: bảng hiển thị dữ liệu thô của một bảng trong cơ sở dữ liệu, có nút Sửa/Xóa từng dòng.
// Dùng ở: trang Dữ liệu gốc.

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { OgButton } from "../../_shared/og-button";
import { displayValue, isImageValue, kindOf, labelOf, rawText } from "./columns";
import type { SuperRow, SuperTableData } from "./types";

/**
 * Bảng dữ liệu thô như superdata.html: cuộn ngang/dọc trong khung, header dính,
 * cột "Thao tác" (Sửa / Xóa) ở cuối và dính bên phải; nhấp đúp ô để sửa.
 */
export function DataGrid({ data, onEdit, onDelete }: { data: SuperTableData; onEdit: (row: SuperRow) => void; onDelete: (row: SuperRow) => void }) {
  // Các cột khóa chính, và kiểu của từng cột (để hiển thị đúng).
  const pk = useMemo(() => new Set(data.primaryKey), [data.primaryKey]);
  const kinds = useMemo(() => Object.fromEntries(data.columns.map((c) => [c.name, kindOf(c, data.rows[0]?.values[c.name])])), [data.columns, data.rows]);

  // Kiểu chung cho ô tiêu đề (dính trên cùng khi cuộn).
  const th = "sticky top-0 z-[2] border-b border-[#edf0f4] bg-[#f7f9fc] px-3 py-2.5 text-left text-[13px] font-bold whitespace-nowrap text-[#475569]";
  return (
    // Khung bảng có thanh cuộn ngang/dọc.
    <div className="max-h-[calc(100dvh-300px)] min-h-[240px] w-full min-w-0 overflow-auto rounded-[9px] border border-[#e5eaf1]">
      <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
        {/* Hàng tiêu đề: tên cột (rê chuột xem kiểu SQL) + cột "Thao tác" dính bên phải */}
        <thead>
          <tr>
            {data.columns.map((c) => (
              <th key={c.name} title={`${c.name} · ${c.type || "?"}${c.notnull ? " · NOT NULL" : ""}${pk.has(c.name) ? " · Khóa chính" : ""}`} className={cn(th, "min-w-[105px]")}>
                {labelOf(c.name)}
              </th>
            ))}
            <th className={cn(th, "right-0 z-[3] shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]")}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {/* Mỗi bản ghi một dòng */}
          {data.rows.map((r, i) => (
            <tr key={JSON.stringify(r.key) || i} className="group [&:last-child>td]:border-b-0">
              {data.columns.map((c) => {
                // Giá trị, kiểu và chữ hiển thị của ô.
                const v = r.values[c.name];
                const kind = kinds[c.name];
                const text = displayValue(c.name, v, kind);
                return (
                  // Ô dữ liệu: nhấp đúp để sửa; ô trống chữ xám; khóa chính chữ đậm.
                  <td
                    key={c.name}
                    title={`${rawText(v).slice(0, 500)}\nNhấp đúp để sửa`}
                    onDoubleClick={() => onEdit(r)}
                    className={cn(
                      "max-w-[260px] cursor-pointer truncate border-b border-[#edf0f4] bg-white px-3 py-2.5 align-top whitespace-nowrap text-[#172033]",
                      "group-hover:bg-[#fbfcff] hover:bg-[#eaf1ff]! hover:outline hover:-outline-offset-1 hover:outline-[#9bb8f0] active:bg-[#dce8ff]!",
                      (v === null || v === undefined || v === "") && "text-[#94a3b8]",
                      kind === "number" && "num",
                      pk.has(c.name) && "font-semibold",
                    )}
                  >
                    {/* Ảnh thì hiện hình nhỏ, còn lại hiện chữ */}
                    {isImageValue(v) && !v.startsWith("data:") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v} alt="" className="h-8 w-8 rounded border border-[#e5eaf1] object-cover" loading="lazy" />
                    ) : (
                      text
                    )}
                  </td>
                );
              })}
              {/* Ô Thao tác: nút Sửa (xanh) và Xóa (đỏ) */}
              <td className="sticky right-0 z-[1] border-b border-[#edf0f4] bg-white px-3 py-2 whitespace-nowrap shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)] group-hover:bg-[#fbfcff]">
                <div className="flex gap-1.5">
                  <OgButton variant="blue" size="sm" onClick={() => onEdit(r)} title="Sửa bản ghi">
                    Sửa
                  </OgButton>
                  <OgButton variant="red" size="sm" onClick={() => onDelete(r)} title="Xóa bản ghi">
                    Xóa
                  </OgButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
