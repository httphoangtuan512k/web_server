"use client";
/**
 * File này: bảng "Đơn đang chạy" nền vàng (như trang cũ) – sửa Đã chạy/Thực tế, nút Chạy thêm, Tạm dừng, Xác nhận xong.
 * Dùng ở: trang Xưởng vận hành; máy tính hiện bảng, điện thoại hiện thẻ.
 */

import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import { DraftInput } from "./setting-input";
import { num, remainingOf, type OperatorPerms, type Order } from "./types";

/** Các hàm xử lý nút/ô nhập trên mỗi đơn (do trang cha truyền vào). */
export interface OrderHandlers {
  onSplit: (o: Order) => void;
  onPause: (o: Order) => void;
  onComplete: (o: Order) => void;
  onEdit: (o: Order) => void;
  onImage: (o: Order) => void;
  onUpdateNum: (o: Order, field: "runOnMachine" | "actualProduced", raw: string) => Promise<boolean>;
}

// Hiện số thô (không định dạng) trong ô nhập.
const fmtPlain = (v: number | null | undefined) => String(num(v));

/** Nút theo .btn của trang cũ (chữ trắng đậm 12px, bo 5px). */
const btn = "inline-block w-full max-w-[160px] cursor-pointer rounded-[5px] px-2.5 py-[7px] text-xs font-bold text-white transition hover:opacity-85 active:scale-[0.98]";
// Màu nút: Sửa (xanh ngọc), Chạy thêm (tím), Tạm dừng (xanh lá), Xác nhận (xanh đậm).
const BTN_EDIT = "bg-[#0f766e]";
const BTN_SPLIT = "bg-[#8b5cf6]";
const BTN_PLAN = "bg-[#16a34a]";
const BTN_DONE = "bg-[#065f46]";
/** .inline-input cũ. */
const inlineInput =
  "num w-20 max-w-full rounded border border-[#94a3b8] bg-white p-1.5 text-center font-bold text-[#0f172a] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 data-[saved]:bg-[#dcfce7]";

// Tiêu đề cột và độ rộng (px) – đúng thứ tự bảng cũ.
const HEADERS: Array<[React.ReactNode, number]> = [
  ["Số đơn", 80],
  ["Mã bao bì", 120],
  ["Hình ảnh", 80],
  [
    <>
      Máy đang
      <br />
      chạy
    </>,
    90,
  ],
  ["Cỡ hạt", 70],
  ["Loại đá", 80],
  ["Độ trắng", 130],
  [
    <>
      Tổng SL
      <br />
      (Tấn)
    </>,
    80,
  ],
  [
    <>
      Đã chạy
      <br />
      (Tấn)
    </>,
    100,
  ],
  [
    <>
      Thực tế
      <br />
      (Tấn)
    </>,
    100,
  ],
  ["Còn lại", 80],
  ["Thao tác", 180],
];

/**
 * Bảng đơn đang chạy (status running, không tạm dừng) – cùng cột/thứ tự/màu bảng trang cũ (nền vàng).
 * Máy tính: bảng (cuộn ngang trong khung nếu hẹp). Điện thoại: mỗi đơn một thẻ vàng.
 */
export function RunningTable({ orders, perms, handlers, loading, error }: { orders: Order[]; perms: OperatorPerms; handlers: OrderHandlers; loading: boolean; error: string }) {
  // Chữ hiện khi không có dòng nào: lỗi / đang tải / trống.
  const empty = error ? `Lỗi tải danh sách đơn: ${error}` : loading ? "Đang tải danh sách đơn…" : "Hiện không có máy nào đang chạy.";
  return (
    <section className="overflow-hidden rounded-xl border border-[#dbe3ed] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
      {/* Máy tính / máy tính bảng */}
      <div className="hidden overflow-x-auto overscroll-x-contain md:block">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-[13px] text-[#333]">
          {/* Đặt độ rộng từng cột */}
          <colgroup>
            {HEADERS.map((h, i) => (
              <col key={i} style={{ width: h[1] }} />
            ))}
          </colgroup>
          {/* Hàng tiêu đề nền xanh navy */}
          <thead>
            <tr>
              {HEADERS.map((h, i) => (
                <th key={i} className="border border-[#cbd5e1] bg-[#1e3a8a] px-1.5 py-2.5 text-center align-middle text-[13px] leading-[1.3] font-bold text-white">
                  {h[0]}
                </th>
              ))}
            </tr>
          </thead>
          {/* Mỗi đơn một dòng; không có thì hiện thông báo */}
          <tbody>
            {orders.length ? (
              orders.map((o) => <Row key={o.id} o={o} perms={perms} handlers={handlers} />)
            ) : (
              <tr>
                <td colSpan={12} className={cn("border border-[#cbd5e1] p-5 text-center", error ? "text-[#dc2626]" : "text-[#475569]")}>
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Điện thoại */}
      <div className="md:hidden">
        {/* Thanh tiêu đề + danh sách thẻ vàng */}
        <div className="bg-[#1e3a8a] px-3 py-2.5 text-sm font-bold text-white">Đơn đang chạy</div>
        {orders.length ? (
          <div className="flex flex-col gap-2 p-2">
            {orders.map((o) => (
              <MobileCard key={o.id} o={o} perms={perms} handlers={handlers} />
            ))}
          </div>
        ) : (
          <p className={cn("p-5 text-center text-[13px]", error ? "text-[#dc2626]" : "text-[#475569]")}>{empty}</p>
        )}
      </div>
    </section>
  );
}

// Kiểu ô bảng chung: viền, căn giữa.
const td = "border border-[#cbd5e1] px-1.5 py-2.5 text-center align-middle break-words";

/** Một dòng bảng (máy tính) cho một đơn. */
function Row({ o, perms, handlers }: { o: Order; perms: OperatorPerms; handlers: OrderHandlers }) {
  return (
    <tr className="bg-[#fef08a] transition-colors hover:bg-[#fde96b]">
      {/* Số đơn + nút Sửa toàn bộ (chỉ super) */}
      <td className={td}>
        <b>{o.orderNumber}</b>
        {perms.isSuper ? (
          <button type="button" className={cn(btn, BTN_EDIT, "mt-2 max-w-[120px]")} onClick={() => handlers.onEdit(o)}>
            ✎ Sửa toàn bộ
          </button>
        ) : null}
      </td>
      {/* Mã bao bì, ảnh, máy, cỡ hạt, loại đá, độ trắng, tổng SL */}
      <td className={td}>{o.packagingCode || "Không có"}</td>
      <td className={td}>
        <Thumb o={o} onOpen={handlers.onImage} />
      </td>
      <td className={td}>{o.machineName || "-"}</td>
      <td className={td}>{o.grainSize || "-"}</td>
      <td className={td}>{o.stoneType || "-"}</td>
      <td className={cn(td, "text-xs")}>{o.whiteness || "-"}</td>
      <td className={cn(td, "num")}>{fmtNumber(num(o.quantity))}</td>
      {/* Ô nhập Đã chạy và Thực tế */}
      <td className={td}>
        <RunInput o={o} perms={perms} handlers={handlers} />
      </td>
      <td className={td}>
        <ActualInput o={o} perms={perms} handlers={handlers} />
      </td>
      {/* Còn lại (chữ đỏ) và nút thao tác */}
      <td className={cn(td, "num font-bold text-[#dc2626]")}>{fmtNumber(remainingOf(o))}</td>
      <td className={td}>
        <Actions o={o} perms={perms} handlers={handlers} />
      </td>
    </tr>
  );
}

/** Thẻ vàng cho một đơn (điện thoại). */
function MobileCard({ o, perms, handlers }: { o: Order; perms: OperatorPerms; handlers: OrderHandlers }) {
  return (
    <article className="rounded-lg border border-[#e5d36a] bg-[#fef08a] p-2.5 text-[13px] text-[#333]">
      {/* Đầu thẻ: ảnh, số đơn, máy, mã bao bì, nút Sửa */}
      <div className="flex items-start gap-2.5">
        <Thumb o={o} onOpen={handlers.onImage} large />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="text-base text-[#0f172a]">{o.orderNumber}</b>
            <span className="rounded bg-[#1e3a8a] px-1.5 py-0.5 text-[11px] font-bold text-white">Máy {o.machineName || "-"}</span>
          </div>
          <p className="mt-0.5 break-words text-[#475569]">{o.packagingCode || "Không có"}</p>
        </div>
        {perms.isSuper ? (
          <button type="button" className={cn(btn, BTN_EDIT, "w-auto shrink-0 px-2")} onClick={() => handlers.onEdit(o)}>
            ✎ Sửa toàn bộ
          </button>
        ) : null}
      </div>
      {/* Thông số: cỡ hạt, loại đá, độ trắng */}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[#e5d36a] pt-2 min-[400px]:grid-cols-3">
        <Info label="Cỡ hạt" value={o.grainSize} />
        <Info label="Loại đá" value={o.stoneType} />
        <Info label="Độ trắng" value={o.whiteness} />
      </dl>
      {/* 4 ô số: Tổng SL, Đã chạy, Thực tế, Còn lại */}
      <div className="mt-2 grid grid-cols-4 items-end gap-2 border-t border-[#e5d36a] pt-2 text-center">
        <Labeled label="Tổng SL">
          <span className="num block py-1.5 font-semibold">{fmtNumber(num(o.quantity))}</span>
        </Labeled>
        <Labeled label="Đã chạy">
          <RunInput o={o} perms={perms} handlers={handlers} />
        </Labeled>
        <Labeled label="Thực tế">
          <ActualInput o={o} perms={perms} handlers={handlers} />
        </Labeled>
        <Labeled label="Còn lại">
          <span className="num block py-1.5 font-bold text-[#dc2626]">{fmtNumber(remainingOf(o))}</span>
        </Labeled>
      </div>
      {/* Nút thao tác xếp lưới 2 cột */}
      <div className="mt-2.5 [&_button]:max-w-none">
        <Actions o={o} perms={perms} handlers={handlers} row />
      </div>
    </article>
  );
}

/** Ảnh nhỏ của đơn; bấm để phóng to. Không có ảnh → "-". */
function Thumb({ o, onOpen, large }: { o: Order; onOpen: (o: Order) => void; large?: boolean }) {
  if (!o.imageData) return <span className={large ? "grid h-14 w-14 shrink-0 place-items-center rounded border border-[#e5d36a] bg-white/60 text-[#94a3b8]" : undefined}>-</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(o)}
      aria-label={`Xem ảnh đơn ${o.orderNumber}`}
      className={cn(
        "inline-block shrink-0 cursor-pointer overflow-hidden rounded border border-[#cbd5e1] bg-white align-middle transition hover:scale-110 hover:border-[#2563eb]",
        large ? "h-14 w-14" : "h-10 w-[45px]",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={o.imageData} alt="" className="h-full w-full object-contain" />
    </button>
  );
}

/** Ô "Đã chạy": người vận hành sửa được, người khác chỉ xem số. */
function RunInput({ o, perms, handlers }: { o: Order; perms: OperatorPerms; handlers: OrderHandlers }) {
  if (!perms.canOperate) return <span className="num">{fmtNumber(num(o.runOnMachine))}</span>;
  return <DraftInput aria-label={`Đã chạy (tấn) đơn ${o.orderNumber}`} value={o.runOnMachine} format={fmtPlain} onCommit={(raw) => handlers.onUpdateNum(o, "runOnMachine", raw)} className={inlineInput} />;
}

/** Ô "Thực tế": chỉ super sửa được (bình thường nhập ở trang Kho). */
function ActualInput({ o, perms, handlers }: { o: Order; perms: OperatorPerms; handlers: OrderHandlers }) {
  if (!perms.isSuper)
    return (
      <span className="num" title="Sản lượng thực tế nhập tại trang Kho">
        {fmtNumber(num(o.actualProduced))}
      </span>
    );
  return <DraftInput aria-label={`Thực tế (tấn) đơn ${o.orderNumber}`} value={o.actualProduced} format={fmtPlain} onCommit={(raw) => handlers.onUpdateNum(o, "actualProduced", raw)} className={inlineInput} />;
}

/** Nhóm nút: + Chạy thêm, Tạm dừng máy (quyền vận hành), ✔ Xác nhận xong (quyền xác nhận). */
function Actions({ o, perms, handlers, row }: { o: Order; perms: OperatorPerms; handlers: OrderHandlers; row?: boolean }) {
  // Không có quyền nào → "Chỉ xem".
  if (!perms.canOperate && !perms.canConfirm) return <span className="text-[#64748b]">Chỉ xem</span>;
  return (
    <div className={row ? "grid grid-cols-2 gap-1.5 [&>*:nth-child(3)]:col-span-2" : "flex flex-col items-center"}>
      {perms.canOperate ? (
        <>
          <button type="button" className={cn(btn, BTN_SPLIT, !row && "my-0.5")} onClick={() => handlers.onSplit(o)}>
            + Chạy thêm
          </button>
          <button type="button" className={cn(btn, BTN_PLAN, !row && "my-0.5")} onClick={() => handlers.onPause(o)}>
            Tạm dừng máy
          </button>
        </>
      ) : null}
      {perms.canConfirm ? (
        <button type="button" className={cn(btn, BTN_DONE, !row && "my-0.5")} onClick={() => handlers.onComplete(o)}>
          ✔ Xác nhận xong
        </button>
      ) : null}
    </div>
  );
}

/** Một cặp nhãn – giá trị trong thẻ điện thoại. */
function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[#64748b]">{label}</dt>
      <dd className="font-medium break-words">{value || "-"}</dd>
    </div>
  );
}

/** Nhãn nhỏ phía trên + nội dung bên dưới. */
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <span className="text-[11px] font-semibold text-[#475569]">{label}</span>
      {children}
    </div>
  );
}
