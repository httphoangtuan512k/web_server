"use client";
/**
 * File này: danh sách lịch sử bảo trì – bảng trên máy tính, thẻ trên điện thoại; ảnh nhỏ bấm để phóng to.
 * Dùng ở: trang Bảo trì; nút Sửa/Xóa chỉ hiện cho Super Admin.
 */

/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format";
import { afterImageOf, faultImageOf, type MaintenanceRecord } from "./types";

/** Màu nút giống baotri.html cũ. */
export const btn = {
  base: "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-[17px] py-2 text-sm font-bold whitespace-nowrap transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
  primary: "bg-[#0f766e] text-white",
  secondary: "bg-[#e2e8f0] text-[#1e293b]",
  export: "bg-[#166534] text-white",
  edit: "bg-[#2563eb] text-white",
  delete: "bg-[#dc2626] text-white",
  small: "min-h-8 px-3 py-1.5 text-xs",
};

/** "08:53 02/11/2026" → giờ và ngày trên 2 dòng như bảng cũ. */
function DateCell({ v }: { v: string }) {
  // Tách giờ và ngày tại dấu cách đầu tiên.
  const s = fmtDateTime(v);
  const i = s.indexOf(" ");
  return i > 0 ? (
    <>
      <span className="block">{s.slice(0, i)}</span>
      <span className="block">{s.slice(i + 1)}</span>
    </>
  ) : (
    <>{s}</>
  );
}

/** Ảnh nhỏ bấm để xem lớn; không có ảnh → "-". */
function Thumb({ src, alt, onOpen, className }: { src: string; alt: string; onOpen: (src: string, alt: string) => void; className?: string }) {
  if (!src) return <span className="text-[#64748b]">-</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(src, alt)}
      className={cn("group inline-block cursor-zoom-in overflow-hidden rounded-md border border-[#d5deea] bg-[#f8fafc] align-middle", className || "h-[65px] w-[75px]")}
      aria-label={`Xem ${alt.toLowerCase()}`}
      title="Bấm để xem ảnh lớn"
    >
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
    </button>
  );
}

/** Props của RecordList: danh sách, quyền sửa/xóa, các hàm xử lý khi bấm. */
type Props = {
  records: MaintenanceRecord[];
  canManage: boolean;
  onOpenImage: (src: string, alt: string) => void;
  onEdit: (r: MaintenanceRecord) => void;
  onDelete: (r: MaintenanceRecord) => void;
  /** Dòng thông báo khi không có bản ghi (đang tải / lỗi / trống). */
  empty?: React.ReactNode;
};

// Tiêu đề cột và kiểu ô tiêu đề / ô dữ liệu / ô mô tả dài.
const HEAD = ["Ngày giờ", "Thiết bị", "Hư hỏng", "Ảnh hư hỏng", "Nội dung sửa chữa", "Trạng thái sau sửa", "Ảnh sau sửa", "Người nhập"];
const th = "sticky top-0 z-[1] bg-[#475569] px-2.5 py-3 text-center text-[15px] font-bold whitespace-nowrap text-white";
const td = "border-t border-[#d5deea] px-2.5 py-[11px] text-center align-middle text-[15px] text-[#17243a]";
const desc = "min-w-[180px] text-left whitespace-pre-wrap [overflow-wrap:anywhere]";

/** Bảng lịch sử bảo trì (máy tính) + dạng thẻ (điện thoại) – cột & nút như bản gốc. */
export function RecordList({ records, canManage, onOpenImage, onEdit, onDelete, empty }: Props) {
  // Nút Sửa + Xóa cho 1 bản ghi (chỉ khi có quyền); row = xếp dọc trong bảng.
  const actions = (r: MaintenanceRecord, row?: boolean) =>
    canManage ? (
      <div className={cn("flex gap-1.5", row ? "flex-col items-center" : "flex-wrap")}>
        <button type="button" className={cn(btn.base, btn.small, btn.edit, row && "w-[60px]")} onClick={() => onEdit(r)}>
          Sửa
        </button>
        <button type="button" className={cn(btn.base, btn.small, btn.delete, row && "w-[60px]")} onClick={() => onDelete(r)}>
          Xóa
        </button>
      </div>
    ) : null;

  return (
    <>
      {/* Máy tính / máy tính bảng: bảng như baotri.html */}
      <div className="hidden max-h-[calc(100dvh-220px)] min-h-[200px] overflow-auto overscroll-x-contain rounded-[9px] border border-[#d5deea] md:block">
        <table className="w-full min-w-[1100px] border-separate border-spacing-0 bg-white">
          <thead>
            <tr>
              {/* Hàng tiêu đề xám, dính trên cùng khi cuộn */}
              {HEAD.map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
              {canManage ? <th className={th}>Thao tác</th> : null}
            </tr>
          </thead>
          <tbody>
            {/* Trống/lỗi → 1 dòng thông báo; có dữ liệu → mỗi bản ghi 1 dòng */}
            {empty ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="p-[30px] text-center text-[#64748b]">
                  {empty}
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-[#f8fafc]">
                  {/* Ngày giờ, thiết bị, hư hỏng, ảnh hư hỏng */}
                  <td className={cn(td, "whitespace-nowrap")}>
                    <DateCell v={r.created_at} />
                  </td>
                  <td className={cn(td, "min-w-[140px] font-bold [overflow-wrap:anywhere]")}>{r.equipment}</td>
                  <td className={cn(td, desc)}>{r.fault_description}</td>
                  <td className={td}>
                    <Thumb src={faultImageOf(r)} alt={`Ảnh hư hỏng – ${r.equipment}`} onOpen={onOpenImage} />
                  </td>
                  {/* Sửa chữa, trạng thái sau, ảnh sau, người nhập, thao tác */}
                  <td className={cn(td, desc)}>{r.repair_content || "-"}</td>
                  <td className={cn(td, desc, "min-w-[150px]")}>{r.after_status || "-"}</td>
                  <td className={td}>
                    <Thumb src={afterImageOf(r)} alt={`Ảnh sau sửa – ${r.equipment}`} onOpen={onOpenImage} />
                  </td>
                  <td className={td}>{r.created_by || "-"}</td>
                  {canManage ? <td className={td}>{actions(r, true)}</td> : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Điện thoại: dạng thẻ */}
      <div className="md:hidden">
        {empty ? (
          <p className="rounded-[9px] border border-[#d5deea] p-[30px] text-center text-[#64748b]">{empty}</p>
        ) : (
          <ul className="space-y-3">
            {records.map((r) => (
              <li key={r.id} className="overflow-hidden rounded-[10px] border border-[#d5deea] bg-white">
                {/* Đầu thẻ: tên thiết bị + ngày giờ */}
                <div className="flex items-start justify-between gap-3 bg-[#475569] px-3 py-2 text-white">
                  <b className="min-w-0 text-[15px] [overflow-wrap:anywhere]">{r.equipment}</b>
                  <span className="shrink-0 text-right text-xs leading-snug text-white/85">
                    <DateCell v={r.created_at} />
                  </span>
                </div>
                <div className="space-y-3 p-3 text-sm">
                  {/* Ảnh hư hỏng + mô tả hư hỏng */}
                  <div className="flex gap-3">
                    <Thumb src={faultImageOf(r)} alt={`Ảnh hư hỏng – ${r.equipment}`} onOpen={onOpenImage} className="h-[72px] w-[84px] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#475569]">Hư hỏng</p>
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{r.fault_description}</p>
                    </div>
                  </div>
                  {/* Ảnh sau sửa + nội dung sửa chữa + trạng thái sau sửa */}
                  <div className="flex gap-3">
                    <Thumb src={afterImageOf(r)} alt={`Ảnh sau sửa – ${r.equipment}`} onOpen={onOpenImage} className="h-[72px] w-[84px] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#475569]">Nội dung sửa chữa</p>
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{r.repair_content || "-"}</p>
                      <p className="mt-1.5 text-xs font-bold text-[#475569]">Trạng thái sau sửa</p>
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{r.after_status || "-"}</p>
                    </div>
                  </div>
                  {/* Chân thẻ: người nhập + nút Sửa/Xóa */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0] pt-2.5">
                    <span className="text-[13px] text-[#64748b]">
                      Người nhập: <b className="text-[#17243a]">{r.created_by || "-"}</b>
                    </span>
                    {actions(r)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
