// File này: nhãn màu cho hành động (Tạo/Sửa/Xóa) và ô hiển thị thay đổi số lượng "cũ → mới".
// Dùng ở: bảng Nhật ký và Lịch sử đơn hàng.
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { normalizeText } from "../../_shared/utils";

// 3 loại hành động: tạo, sửa, xóa.
type Kind = "create" | "edit" | "delete";

/** Như log.html cũ: chứa "Tạo" → xanh lá, chứa "Xóa" → đỏ, còn lại → vàng. */
export function actionKind(action: string): Kind {
  // Bỏ dấu rồi dò từ khóa (xóa trước, rồi tạo; còn lại là sửa).
  const a = normalizeText(action);
  if (/xoa|delete|thu hoi/.test(a)) return "delete";
  if (/tao|create|them/.test(a)) return "create";
  return "edit";
}

// Màu nhãn: xanh lá = tạo, vàng = sửa, đỏ = xóa.
const KIND_CLS: Record<Kind, string> = {
  create: "bg-[#dcfce7] text-[#166534]",
  edit: "bg-[#fef08a] text-[#854d0e]",
  delete: "bg-[#fee2e2] text-[#991b1b]",
};

// Nhãn màu ghi tên hành động.
export function ActionBadge({ action }: { action: string }) {
  return <span className={cn("inline-block rounded px-2 py-1 text-xs leading-tight font-bold", KIND_CLS[actionKind(action)])}>{action || "—"}</span>;
}

/** "12,5 → 15" kèm chênh lệch. */
export function ValueChange({ oldValue, newValue, className }: { oldValue: number | string | null; newValue: number | string | null; className?: string }) {
  // Có giá trị hay không (bỏ qua rỗng).
  const has = (v: unknown) => v !== null && v !== undefined && v !== "";
  // Không có cả hai giá trị → hiện "-".
  if (!has(oldValue) && !has(newValue)) return <span className="text-[#94a3b8]">-</span>;
  // Tính chênh lệch nếu cả hai đều là số.
  const o = Number(oldValue);
  const n = Number(newValue);
  const delta = Number.isFinite(o) && Number.isFinite(n) && has(oldValue) && has(newValue) ? n - o : null;
  return (
    // Hiện: giá trị cũ → giá trị mới (chênh lệch: xanh nếu tăng, đỏ nếu giảm).
    <span className={cn("num inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className="text-[#64748b]">{has(oldValue) ? fmtNumber(oldValue, 3) : "—"}</span>
      <span className="text-[#94a3b8]">→</span>
      <span className="font-semibold text-[#1e293b]">{has(newValue) ? fmtNumber(newValue, 3) : "—"}</span>
      {delta ? (
        <span className={cn("text-xs", delta > 0 ? "text-[#16794b]" : "text-[#b42318]")}>
          ({delta > 0 ? "+" : ""}
          {fmtNumber(delta, 3)})
        </span>
      ) : null}
    </span>
  );
}
