"use client";

import { ArrowDownUp, History, Pin, PinOff, Search } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { VN_TZ } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, Spinner } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { PLC_MACHINES } from "../../van-hanh/_shared/plc";
import { HistoryMatrix } from "./history-matrix";
import type { HistoryMachineFilter, PlcHistoryResponse, PlcHistoryRow } from "./types";

/** Tối đa 1.440 bản ghi mỗi lần tải (server cũ: 1 bản ghi/phút ≈ 1 ngày). */
const LIMIT = 1440;
const HOLD_TO_CLEAR_MS = 2000;

/** HH:mm theo giờ Việt Nam. */
const vnHHmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: VN_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready" };

/** Lịch sử PLC: lọc máy, khoảng ngày, ghim mốc giờ/phút để so sánh. Không nhận props để không vẽ lại theo nhịp 1 giây của trang. */
export const HistoryPanel = memo(function HistoryPanel() {
  const toast = useToast();
  const [machine, setMachine] = useState<HistoryMachineFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pinTime, setPinTime] = useState("");
  const [rows, setRows] = useState<PlcHistoryRow[]>([]);
  const [pins, setPins] = useState<PlcHistoryRow[]>([]);
  const [newestFirst, setNewestFirst] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const reqId = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggered = useRef(false);

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

  function load(f = from, t = to) {
    setState({ status: "loading" });
    void fetchRows(f, t);
  }

  useEffect(() => {
    // Chỉ tải lần đầu; các lần sau do người dùng bấm/đổi bộ lọc.
    void fetchRows("", "");
  }, []);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  function pin() {
    if (!pinTime) return toast.error("Bạn hãy chọn giờ và phút cần ghim.");
    if (!rows.length) return toast.error("Chưa có dữ liệu lịch sử để ghim.");
    const matches = rows.filter((r) => vnHHmm(r.received_at) === pinTime);
    if (!matches.length) return toast.error(`Không tìm thấy thời điểm ${pinTime} trong dữ liệu đang tải. Hãy kiểm tra khoảng ngày hoặc chọn giờ khác.`);
    const chosen = matches[matches.length - 1];
    if (pins.some((p) => Date.parse(p.received_at) === Date.parse(chosen.received_at))) return toast.info("Thời điểm này đã được ghim rồi.");
    setPins((p) => [...p, chosen]);
  }

  function removeLatestPin() {
    if (!pins.length) return toast.info("Hiện chưa có mốc nào được ghim.");
    setPins((p) => p.slice(0, -1));
  }

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
  const endHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  return (
    <Card>
      <CardHeader
        icon={History}
        title="Lịch sử PLC"
        description={`Mỗi cột là một thời điểm lưu (khoảng 1 phút/lần). Tối đa ${LIMIT.toLocaleString("vi-VN")} bản ghi mỗi lần tải.`}
        actions={
          <Button size="sm" variant="ghost" icon={ArrowDownUp} onClick={() => setNewestFirst((x) => !x)}>
            {newestFirst ? "Mới nhất trước" : "Cũ nhất trước"}
          </Button>
        }
      />
      <CardBody className="flex flex-col gap-4">
        <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-3 xl:flex xl:flex-wrap">
          <Field label="Chọn máy" htmlFor="plc-h-machine" className="xl:w-44">
            <Select id="plc-h-machine" value={machine} onChange={(e) => setMachine(e.target.value as HistoryMachineFilter)}>
              <option value="all">Tất cả máy</option>
              {PLC_MACHINES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Từ ngày" htmlFor="plc-h-from" className="xl:w-44">
            <Input
              id="plc-h-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                load(e.target.value, to);
              }}
            />
          </Field>
          <Field label="Đến ngày" htmlFor="plc-h-to" className="xl:w-44">
            <Input
              id="plc-h-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                load(from, e.target.value);
              }}
            />
          </Field>
          <Button icon={Search} onClick={() => load()} loading={state.status === "loading"} className="xl:mr-4">
            Tìm kiếm
          </Button>
          <Field label="Giờ / phút cần ghim" htmlFor="plc-h-pin" className="xl:w-40">
            <Input id="plc-h-pin" type="time" step={60} value={pinTime} onChange={(e) => setPinTime(e.target.value)} />
          </Field>
          <div className="col-span-2 flex gap-2 md:col-span-1">
            <Button variant="accent" icon={Pin} onClick={pin} className="flex-1 xl:flex-none">
              Ghim
            </Button>
            <Button
              variant="danger"
              icon={PinOff}
              className="flex-1 touch-manipulation select-none xl:flex-none"
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
              Xóa ghim
            </Button>
          </div>
        </div>
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          Chọn giờ/phút rồi bấm <b>Ghim</b> để giữ mốc dữ liệu đó cạnh cột Tên tag (so sánh với các thời điểm khác). Bấm <b>Xóa ghim</b> để bỏ mốc ghim mới nhất; giữ nút liên tục 2 giây để bỏ tất cả. Kéo thanh
          cuộn ngang để xem các thời điểm khác; hai cột Máy và Tên tag luôn cố định.
        </p>

        {state.status === "loading" ? (
          <Spinner label="Đang tải lịch sử…" />
        ) : state.status === "error" ? (
          <p className="rounded-lg bg-danger-50 px-4 py-6 text-center text-sm text-danger-600">{state.message}</p>
        ) : !rows.length ? (
          <EmptyState icon={History} title="Không có dữ liệu trong khoảng thời gian này." />
        ) : (
          <HistoryMatrix rows={rows} pins={pins} machine={machine} newestFirst={newestFirst} />
        )}
      </CardBody>
    </Card>
  );
});
