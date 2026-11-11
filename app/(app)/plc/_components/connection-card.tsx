"use client";

import { Clock, Radio, RefreshCw, Server, Tags } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTick } from "../../van-hanh/_shared/hooks";
import { PLC_DEVICE_ID } from "../../van-hanh/_shared/plc";
import { StatusLight } from "../../van-hanh/_shared/status-light";
import type { PlcLatestResponse } from "./types";

/** Thẻ trạng thái kết nối PLC: đèn xanh/đỏ, lần nhận cuối ("x giây trước"), tổng số tag. */
export function ConnectionCard({ latest, error, onRefresh, refreshing }: { latest: PlcLatestResponse | null; error: string; onRefresh: () => void; refreshing: boolean }) {
  useTick(1000);
  const loaded = !!latest || !!error;
  const connected = !!latest?.connected && !error;
  const machines = latest?.payload?.machines ?? {};
  const tagCount = Object.values(machines).reduce((n, m) => n + Object.keys(m ?? {}).length, 0);
  const machineCount = Object.values(machines).filter((m) => m && Object.keys(m).length).length;

  const title = !loaded ? "Đang kiểm tra kết nối" : error ? error : connected ? "Máy B đang Online" : "Máy B Offline";
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span
            className={cn(
              "grid h-14 w-14 shrink-0 place-items-center rounded-2xl",
              !loaded ? "bg-surface-3" : connected ? "bg-success-50" : "bg-danger-50",
            )}
          >
            <StatusLight tone={!loaded ? "neutral" : connected ? "success" : "danger"} pulse={connected} size="lg" />
          </span>
          <div className="min-w-0">
            <p className={cn("text-lg font-semibold", !loaded ? "text-muted" : connected ? "text-success-600" : "text-danger-600")}>{title}</p>
            <p className="text-[13px] text-muted">
              Thiết bị gửi dữ liệu: <b className="font-mono text-fg">{latest?.device_id || PLC_DEVICE_ID}</b> · làm mới mỗi giây
            </p>
          </div>
        </div>
        <Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={onRefresh}>
          Làm mới
        </Button>
      </div>
      <dl className="grid grid-cols-1 gap-px border-t border-line bg-line sm:grid-cols-3">
        <Meta icon={Clock} label="Nhận dữ liệu cuối">
          {latest?.received_at ? (
            <>
              <span className="num">{fmtDateTime(latest.received_at)}</span>
              <span className="num ml-2 text-muted">({fmtRelative(latest.received_at)})</span>
            </>
          ) : (
            <span className="text-muted">Chưa nhận dữ liệu từ máy B</span>
          )}
        </Meta>
        <Meta icon={Radio} label="Mốc thời gian từ C#">
          <span className="num">{latest?.payload?.source_timestamp || "—"}</span>
        </Meta>
        <Meta icon={Tags} label="Thông số đang nhận">
          <span className="num">{tagCount}</span> tag · <span className="num">{machineCount}</span>/4 máy có dữ liệu
        </Meta>
      </dl>
      {latest && !latest.connected && latest.payload ? (
        <p className="flex items-center gap-2 border-t border-line bg-warning-50 px-5 py-2 text-xs text-warning-600">
          <Server size={14} /> Đang hiển thị dữ liệu nhận lần cuối – PLC chưa gửi dữ liệu mới trong 5 giây gần đây.
        </p>
      ) : null}
    </Card>
  );
}

function Meta({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-surface-2 px-5 py-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-subtle" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</dt>
        <dd className="truncate text-sm text-fg">{children}</dd>
      </div>
    </div>
  );
}
