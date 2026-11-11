"use client";
/**
 * File này: khối "Lịch sử PLC" – lọc máy, khoảng ngày, ghim mốc giờ/phút để so sánh, rồi hiện bảng ma trận.
 * Dùng ở: cuối trang Giám sát PLC (/plc).
 */

import { ArrowDownUp } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { VN_TZ } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { PLC_MACHINES } from "../../van-hanh/_shared/plc";
import { HistoryMatrix } from "./history-matrix";
import type { HistoryMachineFilter, PlcHistoryResponse, PlcHistoryRow } from "./types";

/** Tối đa 1.440 bản ghi mỗi lần tải (server cũ: 1 bản ghi/phút ≈ 1 ngày). */
const LIMIT = 1440;
// Giữ nút Xóa 2 giây = xóa hết ghim.
const HOLD_TO_CLEAR_MS = 2000;

/** HH:mm theo giờ Việt Nam. */
const vnHHmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: VN_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

// Trạng thái tải: đang tải / lỗi / xong.
type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready" };

/** Lịch sử PLC: lọc máy, khoảng ngày, ghim mốc giờ/phút để so sánh. Không nhận props để không vẽ lại theo nhịp 1 giây của trang. */
export const HistoryPanel = memo(function HistoryPanel() {
  const toast = useToast();
  // Bộ lọc: máy, từ ngày, đến ngày, giờ cần ghim.
  const [machine, setMachine] = useState<HistoryMachineFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pinTime, setPinTime] = useState("");
  // Dữ liệu lịch sử, các mốc đã ghim, thứ tự cột, trạng thái tải.
  const [rows, setRows] = useState<PlcHistoryRow[]>([]);
  const [pins, setPins] = useState<PlcHistoryRow[]>([]);
  const [newestFirst, setNewestFirst] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Số thứ tự lần tải (bỏ kết quả cũ về muộn) và bộ hẹn giờ giữ nút Xóa.
  const reqId = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggered = useRef(false);

  // Gọi API lịch sử theo khoảng ngày; chỉ nhận kết quả của lần gọi mới nhất.
  async function fetchRows(f: string, t: string) {
    const id = ++reqId.current;
    const params = new URLSearchParams({ limit: String(LIMIT) });
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    try {
      const d = await api.get<PlcHistoryResponse>(`/api/plc/history?${params.toString()}`);
      if (id !== reqId.current) return;
      setRows(d.rows ?? []);
      setState({ status: "ready" });
    } catch (e) {
      if (id !== reqId.current) return;
      setState({ status: "error", message: errorMessage(e) });
    }
  }

  // Tải lại (hiện "Đang tải").
  function load(f = from, t = to) {
    setState({ status: "loading" });
    void fetchRows(f, t);
  }

  useEffect(() => {
    // Chỉ tải lần đầu; các lần sau do người dùng bấm/đổi bộ lọc.
    void fetchRows("", "");
  }, []);

  // Dọn bộ hẹn giờ khi rời trang.
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  // Ghim: tìm thời điểm khớp giờ:phút đã chọn rồi thêm vào danh sách ghim.
  function pin() {
    if (!pinTime) return toast.error("Bạn hãy chọn giờ và phút cần ghim.");
    if (!rows.length) return toast.error("Chưa có dữ liệu lịch sử để ghim.");
    const matches = rows.filter((r) => vnHHmm(r.received_at) === pinTime);
    if (!matches.length) return toast.error(`Không tìm thấy thời điểm ${pinTime} trong dữ liệu đang tải. Hãy kiểm tra khoảng ngày hoặc chọn giờ khác.`);
    const chosen = matches[matches.length - 1];
    if (pins.some((p) => Date.parse(p.received_at) === Date.parse(chosen.received_at))) return toast.info("Thời điểm này đã được ghim rồi.");
    setPins((p) => [...p, chosen]);
  }

  // Bấm Xóa: bỏ mốc ghim mới nhất.
  function removeLatestPin() {
    if (!pins.length) return toast.info("Hiện chưa có mốc nào được ghim.");
    setPins((p) => p.slice(0, -1));
  }

  // Nhấn giữ nút Xóa: sau 2 giây bỏ hết ghim.
  const startHold = () => {
    holdTriggered.current = false;
    holdTimer.current = setTimeout(() => {
      holdTriggered.current = true;
      if (pins.length) {
        setPins([]);
        toast.success("Đã bỏ toàn bộ các mốc đã ghim.");
      }
    }, HOLD_TO_CLEAR_MS);
  };
  // Thả tay / rời nút: hủy đếm giờ.
  const endHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  return (
    <section className="rounded-xl border border-[#dbe3ed] bg-white p-2.5 shadow-[0_2px_8px_#0f172a0a] sm:p-4">
      {/* Tiêu đề + nút đảo thứ tự cột */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[#1e3a8a]">Lịch sử PLC</h2>
        <button
          type="button"
          onClick={() => setNewestFirst((x) => !x)}
          className="inline-flex items-center gap-1.5 rounded-[7px] border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#475569] transition hover:border-[#1e3a8a] hover:text-[#1e3a8a]"
        >
          <ArrowDownUp size={13} />
          {newestFirst ? "Mới nhất trước" : "Cũ nhất trước"}
        </button>
      </div>

      {/* Bộ lọc: 2 cột trên điện thoại, xếp hàng ngang trên máy tính */}
      <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
        <label className={lbl}>
          Chọn máy
          <select
            className={ctl}
            value={machine}
            onChange={(e) => setMachine(e.target.value as HistoryMachineFilter)}
          >
            <option value="all">Tất cả máy</option>
            {PLC_MACHINES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {/* Từ ngày / Đến ngày: đổi là tải lại ngay */}
        <label className={lbl}>
          Từ ngày
          <input
            className={ctl}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              load(e.target.value, to);
            }}
          />
        </label>
        <label className={lbl}>
          Đến ngày
          <input
            className={ctl}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              load(from, e.target.value);
            }}
          />
        </label>
        {/* Chọn giờ:phút cần ghim */}
        <label className={lbl}>
          Giờ / phút cần ghim
          <input className={ctl} type="time" step={60} value={pinTime} onChange={(e) => setPinTime(e.target.value)} />
        </label>
        {/* Nút Ghim, Xóa (bấm = bỏ 1, giữ 2 giây = bỏ hết), Tìm kiếm */}
        <div className="col-span-2 grid grid-cols-3 gap-2 sm:flex">
          <button type="button" onClick={pin} className={cn(btn, "bg-[#1d4ed8] hover:bg-[#1e40af]")}>
            Ghim
          </button>
          <button
            type="button"
            className={cn(btn, "touch-manipulation bg-[#dc2626] select-none hover:bg-[#b91c1c]")}
            title="Bấm để xóa ghim mới nhất; giữ 2 giây để xóa tất cả"
            onClick={() => {
              if (!holdTriggered.current) removeLatestPin();
            }}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
          >
            Xóa
          </button>
          <button type="button" onClick={() => load()} disabled={state.status === "loading"} className={cn(btn, "bg-[#1d4ed8] hover:bg-[#1e40af]")}>
            Tìm kiếm
          </button>
        </div>
      </div>
      {/* Hướng dẫn sử dụng */}
      <p className="my-2 text-xs text-[#64748b]">
        Chọn giờ/phút rồi bấm Ghim để lưu mốc dữ liệu vào cạnh cột Tên tag. Bấm Xóa để bỏ mốc ghim mới nhất; giữ nút Xóa liên tục 2 giây để bỏ tất cả.
      </p>
      <p className="my-2.5 text-[13px] text-[#64748b]">
        Mỗi cột là một thời điểm lưu. Kéo thanh cuộn ngang để xem các thời điểm cũ hơn; hai cột Máy và Tên tag luôn được cố định. Tối đa {LIMIT.toLocaleString("vi-VN")} bản ghi mỗi lần tải.
      </p>

      {/* Đang tải / lỗi / trống / bảng ma trận */}
      {state.status === "loading" ? (
        <div className={empty}>Đang tải lịch sử...</div>
      ) : state.status === "error" ? (
        <div className={cn(empty, "text-[#dc2626]")}>{state.message}</div>
      ) : !rows.length ? (
        <div className={empty}>Không có dữ liệu trong khoảng thời gian này.</div>
      ) : (
        <HistoryMatrix rows={rows} pins={pins} machine={machine} newestFirst={newestFirst} />
      )}
    </section>
  );
});

// Kiểu dáng dùng chung: nhãn, ô nhập, nút, khung trống.
const lbl = "flex min-w-0 flex-col gap-[5px] text-xs text-[#64748b]";
const ctl =
  "min-h-9 w-full min-w-0 rounded-[7px] border border-[#cbd5e1] bg-white p-2 text-sm text-[#172033] outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/15 sm:w-auto";
const btn = "min-h-9 rounded-[7px] px-[13px] py-[9px] text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-50";
const empty = "rounded-lg bg-[#f8fafc] p-5 text-center text-[#64748b]";
