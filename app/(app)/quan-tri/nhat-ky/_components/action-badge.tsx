import { Badge } from "@/components/ui/card";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { normalizeText } from "../../_shared/utils";

type Tone = "neutral" | "success" | "danger" | "warning" | "info";

/** Màu theo loại hành động (Tạo/Xóa/Tạm dừng/…). */
export function actionTone(action: string): Tone {
  const a = normalizeText(action);
  if (/xoa|delete|thu hoi/.test(a)) return "danger";
  if (/tao|create|bat dau|them/.test(a)) return "success";
  if (/tam dung|pause|khoa/.test(a)) return "warning";
  if (/xac nhan|hoan thanh|chot|confirm|close/.test(a)) return "info";
  return "neutral";
}

export function ActionBadge({ action }: { action: string }) {
  return <Badge tone={actionTone(action)}>{action || "—"}</Badge>;
}

/** "12,5 → 15" kèm chênh lệch. */
export function ValueChange({ oldValue, newValue, className }: { oldValue: number | string | null; newValue: number | string | null; className?: string }) {
  const has = (v: unknown) => v !== null && v !== undefined && v !== "";
  if (!has(oldValue) && !has(newValue)) return <span className="text-subtle">—</span>;
  const o = Number(oldValue);
  const n = Number(newValue);
  const delta = Number.isFinite(o) && Number.isFinite(n) && has(oldValue) && has(newValue) ? n - o : null;
  return (
    <span className={cn("num inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className="text-muted">{has(oldValue) ? fmtNumber(oldValue, 3) : "—"}</span>
      <span className="text-subtle">→</span>
      <span className="font-medium text-fg">{has(newValue) ? fmtNumber(newValue, 3) : "—"}</span>
      {delta ? (
        <span className={cn("text-xs", delta > 0 ? "text-success-600" : "text-danger-600")}>
          ({delta > 0 ? "+" : ""}
          {fmtNumber(delta, 3)})
        </span>
      ) : null}
    </span>
  );
}
