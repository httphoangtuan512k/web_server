/**
 * File này: màu và cỡ nút dùng chung cho trang Tài liệu (giống bản cũ).
 * Dùng ở: các file trong tai-lieu/_components, ghép bằng cn(tlBtn.base, tlBtn.sm, tlBtn.blue).
 */
/** Màu nút giống quanlytailieu.html cũ (.btn xanh #2563eb, .gray #475569, .green #15803d, .red #b91c1c). */
// base = kiểu chung; md/sm = cỡ nút; blue/gray/green/red/slate = màu nền.
export const tlBtn = {
  base: "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[7px] font-bold whitespace-nowrap text-white transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
  md: "min-h-10 px-3.5 py-2 text-sm",
  sm: "min-h-8 px-[9px] py-1.5 text-xs",
  blue: "bg-[#2563eb]",
  gray: "bg-[#475569]",
  green: "bg-[#15803d]",
  red: "bg-[#b91c1c]",
  slate: "bg-[#64748b]",
};
