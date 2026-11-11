"use client";

import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { Table, Td, Th, THead } from "@/components/ui/table";
import { displayValue, isImageValue, kindOf, labelOf, rawText } from "./columns";
import type { SuperRow, SuperTableData } from "./types";

/** Bảng dữ liệu thô: cuộn ngang/dọc, cột thao tác cố định bên trái, nhấp đúp ô để sửa. */
export function DataGrid({ data, onEdit, onDelete }: { data: SuperTableData; onEdit: (row: SuperRow) => void; onDelete: (row: SuperRow) => void }) {
  const pk = useMemo(() => new Set(data.primaryKey), [data.primaryKey]);
  const kinds = useMemo(() => Object.fromEntries(data.columns.map((c) => [c.name, kindOf(c, data.rows[0]?.values[c.name])])), [data.columns, data.rows]);

  return (
    <Table maxHeight="calc(100dvh - 300px)" className="min-h-[240px]">
      <THead>
        <tr>
          <Th className="sticky left-0 z-[2] w-[84px] bg-surface-2">Thao tác</Th>
          {data.columns.map((c) => (
            <Th key={c.name} title={`${c.name} · ${c.type || "?"}${c.notnull ? " · NOT NULL" : ""}`} className="min-w-[110px] normal-case">
              <span className="inline-flex items-center gap-1">
                {pk.has(c.name) ? <KeyRound size={11} className="text-brand-600" /> : null}
                <span className="tracking-normal">{labelOf(c.name)}</span>
              </span>
              <span className="block font-mono text-[10px] font-normal tracking-normal text-subtle">{c.name}</span>
            </Th>
          ))}
        </tr>
      </THead>
      <tbody>
        {data.rows.map((r, i) => (
          <tr key={JSON.stringify(r.key) || i} className="group [&:last-child>td]:border-b-0">
            <Td className="sticky left-0 bg-surface py-1.5! group-hover:bg-surface-2">
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => onEdit(r)}
                  title="Sửa bản ghi"
                  aria-label="Sửa bản ghi"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-600"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(r)}
                  title="Xóa bản ghi"
                  aria-label="Xóa bản ghi"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Td>
            {data.columns.map((c) => {
              const v = r.values[c.name];
              const kind = kinds[c.name];
              const text = displayValue(c.name, v, kind);
              return (
                <Td
                  key={c.name}
                  title={`${rawText(v).slice(0, 500)}\nNhấp đúp để sửa`}
                  onDoubleClick={() => onEdit(r)}
                  className={cn(
                    "max-w-[260px] cursor-pointer truncate text-[13px] whitespace-nowrap group-hover:bg-surface-2 hover:bg-brand-50!",
                    (v === null || v === undefined || v === "") && "text-subtle",
                    kind === "number" && "num text-right",
                    pk.has(c.name) && "font-medium",
                  )}
                >
                  {isImageValue(v) && !v.startsWith("data:") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v} alt="" className="h-8 w-8 rounded border border-line object-cover" loading="lazy" />
                  ) : (
                    text
                  )}
                </Td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
