"use client";

import { KeyRound, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/card";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { OgButton } from "../../_shared/og-button";
import { fromFormValue, isImageValue, kindOf, labelOf, toFormValue } from "./columns";
import type { CellValue, ColumnKind, SuperColumn, SuperRow, SuperTableData } from "./types";

const KIND_HINT: Partial<Record<ColumnKind, string>> = {
  json: "JSON",
  datetime: "Giờ Việt Nam",
  number: "Số",
};

/** Sửa một bản ghi – PATCH /api/super-data/:table { key, values } (chỉ gửi các cột đã thay đổi). */
export function RowEditorModal({ data, row, onClose, onSaved }: { data: SuperTableData; row: SuperRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const pk = useMemo(() => new Set(data.primaryKey), [data.primaryKey]);
  const fields = useMemo(
    () => data.columns.map((c) => ({ col: c, kind: kindOf(c, row.values[c.name]), readOnly: pk.has(c.name) || c.pk })),
    [data.columns, row.values, pk],
  );
  const initial = useMemo(() => Object.fromEntries(fields.map((f) => [f.col.name, toFormValue(row.values[f.col.name], f.kind)])), [fields, row.values]);
  const [form, setForm] = useState<Record<string, string | boolean>>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const changed = fields.filter((f) => !f.readOnly && form[f.col.name] !== initial[f.col.name]);

  async function save() {
    if (!changed.length) {
      toast.info("Không có thay đổi nào để lưu.");
      return onClose();
    }
    const values: Record<string, CellValue> = {};
    try {
      for (const f of changed) values[f.col.name] = fromFormValue(f.col, f.kind, form[f.col.name]);
    } catch (e) {
      return setError(errorMessage(e));
    }
    setError("");
    setSaving(true);
    try {
      await api.patch(`/api/super-data/${encodeURIComponent(data.table)}`, { key: row.key, values });
      toast.success("Đã cập nhật dữ liệu.");
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Sửa dữ liệu · ${data.label}`}
      description={
        <span className="font-mono text-xs">
          {data.table} · khóa {JSON.stringify(row.key)}
        </span>
      }
      footer={
        <>
          <p className="mr-auto self-center text-[13px] text-muted">
            {changed.length ? (
              <>
                Đã sửa <span className="num font-medium text-fg">{changed.length}</span> trường
              </>
            ) : (
              "Chưa có thay đổi"
            )}
          </p>
          <OgButton variant="soft" className="rounded-lg!" onClick={onClose} disabled={saving}>
            Hủy
          </OgButton>
          <OgButton variant="blue" className="rounded-lg!" loading={saving} onClick={save} disabled={!changed.length}>
            Lưu thay đổi
          </OgButton>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning-600/30 bg-warning-50 px-3.5 py-2.5 text-[13px] text-fg">
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warning-600" />
        <p>
          Bạn đang <b>chỉnh trực tiếp dữ liệu gốc</b>. Thay đổi có hiệu lực ngay, không qua kiểm tra nghiệp vụ và không ghi lịch sử.
        </p>
      </div>
      {error ? <p className="mb-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p> : null}
      <form
        className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {fields.map(({ col, kind, readOnly }) => {
          const full = kind === "json" || kind === "longtext";
          const value = form[col.name];
          const dirty = !readOnly && value !== initial[col.name];
          const set = (v: string | boolean) => setForm((s) => ({ ...s, [col.name]: v }));
          const id = `sd-${col.name}`;
          return (
            <div key={col.name} className={cn("flex min-w-0 flex-col gap-1.5", full && "sm:col-span-2")}>
              <label htmlFor={id} className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-fg" title={col.name}>
                {labelOf(col.name)}
                {col.notnull && !readOnly ? <span className="text-danger-600">*</span> : null}
                {readOnly ? (
                  <Badge tone="brand" className="px-1.5! py-0! text-[10px]">
                    <KeyRound size={10} /> Khóa chính
                  </Badge>
                ) : null}
                {dirty ? <span className="h-1.5 w-1.5 rounded-full bg-accent-600" title="Đã sửa" /> : null}
                <span className="ml-auto font-mono text-[11px] font-normal text-subtle">
                  {col.name}
                  {KIND_HINT[kind] ? ` · ${KIND_HINT[kind]}` : ""}
                </span>
              </label>
              <FieldInput id={id} col={col} kind={kind} value={value} readOnly={readOnly} onChange={set} />
              {isImageValue(row.values[col.name]) && typeof value === "string" && isImageValue(value) ? (
                <a href={value} target="_blank" rel="noreferrer" className="mt-1 block h-24 w-24 overflow-hidden rounded-lg border border-line bg-surface-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={value} alt="" className="h-full w-full object-cover" />
                </a>
              ) : null}
            </div>
          );
        })}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

function FieldInput({
  id,
  col,
  kind,
  value,
  readOnly,
  onChange,
}: {
  id: string;
  col: SuperColumn;
  kind: ColumnKind;
  value: string | boolean;
  readOnly: boolean;
  onChange: (v: string | boolean) => void;
}) {
  const ro = readOnly ? "bg-surface-3 text-muted" : "";
  const placeholder = col.notnull ? undefined : "Để trống = NULL";
  switch (kind) {
    case "boolean":
      return (
        <div className="flex h-10 items-center">
          <Checkbox id={id} label={value ? "Có" : "Không"} checked={Boolean(value)} disabled={readOnly} onChange={(e) => onChange(e.target.checked)} />
        </div>
      );
    case "json":
    case "longtext":
      return (
        <Textarea
          id={id}
          value={String(value)}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className={cn(kind === "json" && "font-mono text-xs", "min-h-[96px]", ro)}
          rows={kind === "json" ? Math.min(14, Math.max(4, String(value).split("\n").length + 1)) : 4}
        />
      );
    case "number":
      return (
        <Input id={id} inputMode="decimal" className={cn("num", ro)} value={String(value)} readOnly={readOnly} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      );
    case "datetime":
      return <Input id={id} type="datetime-local" step={1} className={ro} value={String(value)} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input id={id} type="date" className={ro} value={String(value)} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <Input id={id} className={ro} value={String(value)} readOnly={readOnly} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}
