"use client";
/**
 * File này: danh sách đơn – dạng bảng (máy tính) hoặc dạng thẻ (điện thoại), màu theo trạng thái.
 * Dùng ở: ke-hoach-page.tsx.
 */

import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/format";
import { OrderActionButtons, type OrderActionKind } from "./order-actions";
import { OrderThumb, ROW_BG, StatusText } from "./order-bits";
import type { OrderGroup, OrderPerms } from "./types";
import { fmtTons, statusKey } from "./utils";

/** Dữ liệu chung cho bảng và thẻ: danh sách nhóm đơn, quyền, đơn đang xử lý, các hàm khi bấm. */
interface ListProps {
  groups: OrderGroup[];
  perms: OrderPerms;
  pending: string | null;
  onOpen: (g: OrderGroup) => void;
  onAction: (kind: OrderActionKind, g: OrderGroup) => void;
  onOpenImage: (src: string, title: string) => void;
}

/** Thông tin máy / người chạy (hiện khi rê chuột – trang cũ chỉ xem trong chi tiết). */
const tip = (g: OrderGroup) =>
  [g.orderNumber && `Đơn ${g.orderNumber}`, g.machineNames.length && `Máy: ${g.machineNames.join(", ")}`, g.runnerNames.length && `Người chạy: ${g.runnerNames.join(" + ")}`]
    .filter(Boolean)
    .join(" · ");

/** Danh sách đơn: bảng như trang cũ (≥ md, cuộn ngang trong khung nếu hẹp), thẻ trên điện thoại. Khi in luôn dùng bảng. */
export function OrderList(props: ListProps) {
  return (
    <>
      {/* Màn hình vừa/lớn (và khi in): dạng bảng. */}
      <div className="hidden md:block print:block">
        <OrderTable {...props} />
      </div>
      {/* Điện thoại: dạng thẻ. */}
      <div className="md:hidden print:hidden">
        <OrderCards {...props} />
      </div>
    </>
  );
}

/** Độ rộng cột theo trang cũ: 16 / 14 / 9 / 8 / 11 / 28 / 14 %. */
const COLS = ["16%", "14%", "9%", "8%", "11%", "28%", "14%"];

// Kiểu ô tiêu đề (nền xanh navy chữ trắng, dính trên khi cuộn) và ô dữ liệu (viền xám).
const th = "sticky top-0 z-[2] border-r border-[#60788f] bg-[#244c75] px-1.5 py-2.5 text-center text-xs font-bold text-white last:border-r-0";
const td = "border-r border-b border-[#a2adb8]/70 px-1.5 py-2 text-center align-middle [overflow-wrap:anywhere] last:border-r-0";

/** Bảng đơn hàng 7 cột; màu dòng theo trạng thái; bấm dòng để xem chi tiết. */
function OrderTable({ groups, perms, pending, onOpen, onAction, onOpenImage }: ListProps) {
  return (
    // Khung cuộn, cao tối đa 75% màn hình.
    <div className="max-h-[75vh] w-full overflow-auto overscroll-x-contain print:max-h-none print:overflow-visible">
      <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-[12.5px] text-[#202832] print:min-w-0">
        {/* Độ rộng từng cột. */}
        <colgroup>
          {COLS.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        {/* Hàng tiêu đề cột. */}
        <thead>
          <tr>
            <th className={th}>Mã bao bì</th>
            <th className={th}>Cỡ hạt</th>
            <th className={th}>
              Số lượng
              <br />
              (tấn)
            </th>
            <th className={th}>Hình ảnh</th>
            <th className={th}>Trạng thái</th>
            <th className={cn(th, "no-print")}>Thao tác</th>
            <th className={th}>Ngày hoàn thành</th>
          </tr>
        </thead>
        {/* Mỗi nhóm đơn một dòng. */}
        <tbody>
          {groups.map((g) => (
            // Dòng: trắng = chưa chạy, vàng = đang chạy/tạm dừng, xanh lá = xong; rê chuột hiện máy/người chạy.
            <tr
              key={g.key}
              onClick={() => onOpen(g)}
              title={tip(g)}
              className={cn("cursor-pointer transition-[filter] hover:brightness-[0.96] [&:last-child>td]:border-b-0", ROW_BG[statusKey(g)])}
            >
              {/* Mã bao bì, cỡ hạt, số lượng. */}
              <td className={cn(td, "pl-3 text-left")}>
                <p className="font-semibold">{g.packagingCode || "-"}</p>
              </td>
              <td className={cn(td, "pl-3 text-left")}>{g.grainSize || "-"}</td>
              <td className={cn(td, "num font-semibold")}>{fmtTons(g.quantity)}</td>
              {/* Ảnh bao bì nhỏ (bấm để xem lớn). */}
              <td className={td}>
                <OrderThumb src={g.imageData} alt={`Đơn ${g.orderNumber}`} onOpen={() => onOpenImage(g.imageData, `Đơn ${g.orderNumber}`)} />
              </td>
              {/* Trạng thái + "Còn lại: x tấn". */}
              <td className={td}>
                <StatusText order={g} />
              </td>
              {/* Các nút thao tác (👁 Xem, ▶ Chạy…); ẩn khi in. */}
              <td className={cn(td, "no-print py-1.5")}>
                <OrderActionButtons group={g} perms={perms} onAction={onAction} pending={pending} withView className="justify-center" />
              </td>
              {/* Ngày hoàn thành. */}
              <td className={cn(td, "num")}>{fmtDate(g.completedAt, "-")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Điện thoại: mỗi đơn một thẻ cùng màu trạng thái, đủ thông tin cột & đủ nút như trang cũ. */
function OrderCards({ groups, perms, pending, onOpen, onAction, onOpenImage }: ListProps) {
  return (
    // Danh sách thẻ xếp dọc.
    <ul className="space-y-2.5 p-2.5">
      {groups.map((g) => (
        // Một thẻ, nền cùng màu trạng thái.
        <li
          key={g.key}
          className={cn("overflow-hidden rounded-xl border border-black/15 text-[#202832] shadow-[0_2px_8px_rgba(15,23,42,0.08)]", ROW_BG[statusKey(g)])}
        >
          {/* Hàng trên: ảnh nhỏ + mã bao bì, cỡ hạt + trạng thái (bấm để xem chi tiết). */}
          <div className="flex min-w-0 items-start gap-3 px-3 pt-3">
            <span className="grid h-10 w-[45px] shrink-0 place-items-center rounded bg-white/60">
              <OrderThumb src={g.imageData} alt={`Đơn ${g.orderNumber}`} onOpen={() => onOpenImage(g.imageData, `Đơn ${g.orderNumber}`)} />
            </span>
            <button
              type="button"
              onClick={() => onOpen(g)}
              className="flex min-w-0 flex-1 items-start gap-2 text-left"
              aria-label={`Xem chi tiết đơn ${g.orderNumber}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-snug font-bold break-words">{g.packagingCode || "-"}</span>
                <span className="mt-0.5 block text-xs break-words text-black/65">{g.grainSize || "-"}</span>
              </span>
              <StatusText order={g} className="max-w-[48%] shrink-0 text-right text-xs" />
            </button>
          </div>
          {/* Ô trắng mờ: số lượng và ngày hoàn thành. */}
          <dl className="mx-3 mt-2.5 grid grid-cols-2 gap-2 rounded-lg bg-white/55 px-2.5 py-2 text-xs">
            <div className="min-w-0">
              <dt className="text-[11px] text-black/60">Số lượng (tấn)</dt>
              <dd className="num font-bold">{fmtTons(g.quantity)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-black/60">Ngày hoàn thành</dt>
              <dd className="num font-bold">{fmtDate(g.completedAt, "-")}</dd>
            </div>
          </dl>
          {/* Hàng nút thao tác. */}
          <OrderActionButtons group={g} perms={perms} onAction={onAction} pending={pending} withView className="gap-1.5 px-3 pt-2.5 pb-3" />
        </li>
      ))}
    </ul>
  );
}
