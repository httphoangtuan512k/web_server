"use client";

import { AlertTriangle, Cog, Info, PackageOpen, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtNumber } from "@/lib/format";
import { Badge, Card } from "@/components/ui/card";
import type { MillConfig } from "../_shared/plc";
import { StatusLight } from "../_shared/status-light";
import { modeLabel, type ScadaView } from "./scada";
import { SettingInput } from "./setting-input";
import { levelFromSensors, TankGauge } from "./tank-gauge";
import { producedOf, remainingOf, type Order, type PlcStateKey } from "./types";

const fmt2 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "0.00" : Number(v).toFixed(2));
const fmtSetpoint = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "20" : String(Number(v)));
const fmtCoeff = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "1" : String(Number(v)));

const RUN_BADGE = {
  running: { tone: "success", text: "Đang nghiền" },
  stopped: { tone: "neutral", text: "Đang dừng" },
  offline: { tone: "danger", text: "Mất kết nối" },
  unknown: { tone: "neutral", text: "Đang chờ dữ liệu" },
} as const;

export function MillCard({
  cfg,
  view,
  orders,
  canEdit,
  onSave,
}: {
  cfg: MillConfig;
  view: ScadaView;
  /** Đơn đang chạy được gán cho máy này (theo tên máy). */
  orders: Order[];
  canEdit: boolean;
  onSave: (key: PlcStateKey, raw: string) => Promise<boolean>;
}) {
  const running = view.run === "running";
  const badge = RUN_BADGE[view.run];
  const s = view.state;
  const hopperFill = Number(s.hopperSetpoint) > 0 ? Number(s.hopper) / Number(s.hopperSetpoint) : null;
  const feedingA = view.feedA && !view.feedB;
  const feedingB = view.feedB && !view.feedA;

  return (
    <Card className={cn("overflow-hidden", running && "ring-1 ring-success-600/30")}>
      {/* Đầu thẻ */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", running ? "bg-success-50 text-success-600" : "bg-surface-3 text-muted")}>
            <Cog size={24} className={cn(running && "animate-spin [animation-duration:2.4s]")} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-fg">{cfg.title}</h2>
            <p className="text-[13px] text-muted">
              {cfg.model} · tag PLC <span className="font-mono text-xs">{cfg.machine}</span>
            </p>
          </div>
        </div>
        <Badge tone={badge.tone} className="h-8 gap-2 px-3 text-[13px]">
          <StatusLight tone={view.run === "running" ? "success" : view.run === "offline" ? "danger" : "neutral"} pulse={running} size="sm" />
          {badge.text}
        </Badge>
      </div>

      {/* Đơn hiện tại */}
      <CurrentOrders orders={orders} />

      {/* Sơ đồ công nghệ: Phễu → Máy nghiền → Silo A / Silo B */}
      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Phễu cấp liệu" subtitle="Cảm biến 200">
          <TankGauge shape="hopper" fill={hopperFill} high={view.sensors.hopperHigh} low={view.sensors.hopperLow} caption={hopperFill === null ? "—" : `${Math.round(Math.min(1, hopperFill) * 100)}% mức đầy`} />
          <div className="grid grid-cols-2 gap-2">
            <ValueOrInput label="Tồn phễu" unit="tấn" tone="accent" value={s.hopper} format={fmt2} canEdit={canEdit} onCommit={(raw) => onSave("hopper", raw)} />
            <ValueOrInput label="Mức đầy" unit="tấn" tone="neutral" value={s.hopperSetpoint} format={fmtSetpoint} canEdit={canEdit} onCommit={(raw) => onSave("hopperSetpoint", raw)} />
          </div>
        </Panel>

        <Panel title="Máy nghiền" subtitle={cfg.model}>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
            <div
              className={cn(
                "grid h-28 w-28 place-items-center rounded-full border-4",
                running ? "border-success-600/40 bg-success-50" : view.run === "offline" ? "border-danger-600/30 bg-danger-50" : "border-line-strong bg-surface-2",
              )}
            >
              {view.run === "offline" ? (
                <WifiOff size={40} className="text-danger-600" />
              ) : (
                <Cog size={52} className={cn(running ? "animate-spin text-success-600 [animation-duration:2.4s]" : "text-subtle")} />
              )}
            </div>
            <p className="num text-xs text-muted">Tần số: {view.millHz === null ? "—" : `${fmtNumber(view.millHz, 2)} Hz`}</p>
          </div>
          <BigValue label="Cân định lượng" value={view.production === null ? "--" : view.production.toFixed(2)} tone="brand" />
        </Panel>

        <SiloPanel
          name="A"
          mode={view.modeA}
          feeding={feedingA}
          high={view.sensors.siloAHigh}
          low={view.sensors.siloALow}
          stock={s.stockA}
          counter={view.counterA}
          coeff={s.coeffA}
          canEdit={canEdit}
          onSaveStock={(raw) => onSave("stockA", raw)}
          onSaveCoeff={(raw) => onSave("coeffA", raw)}
        />
        <SiloPanel
          name="B"
          mode={view.modeB}
          feeding={feedingB}
          high={view.sensors.siloBHigh}
          low={view.sensors.siloBLow}
          stock={s.stockB}
          counter={view.counterB}
          coeff={s.coeffB}
          canEdit={canEdit}
          onSaveStock={(raw) => onSave("stockB", raw)}
          onSaveCoeff={(raw) => onSave("coeffB", raw)}
        />
      </div>

      {/* Chân thẻ: thông báo PLC */}
      <div
        className={cn(
          "flex items-start gap-2 border-t border-line px-5 py-2.5 text-xs",
          view.tone === "danger" ? "bg-danger-50 text-danger-600" : view.tone === "warning" ? "bg-warning-50 text-warning-600" : "bg-surface-2 text-muted",
        )}
      >
        {view.tone === "info" ? <Info size={14} className="mt-px shrink-0" /> : <AlertTriangle size={14} className="mt-px shrink-0" />}
        <span className="num min-w-0 break-words">{view.message}</span>
      </div>
    </Card>
  );
}

function Panel({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 bg-surface p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-wide text-fg uppercase">{title}</h3>
          {subtitle ? <p className="truncate text-[11px] text-subtle">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function BigValue({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone: "brand" | "accent" | "neutral" }) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2",
        tone === "accent" ? "bg-accent-50" : tone === "brand" ? "bg-brand-50" : "bg-surface-3",
      )}
    >
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="num text-xl leading-tight font-semibold text-fg">
        {value}
        {unit ? <span className="ml-1 text-xs font-medium text-muted">{unit}</span> : null}
      </p>
    </div>
  );
}

/** Người có quyền: ô nhập lưu ngay; người chỉ xem: ô số liệu tĩnh. */
function ValueOrInput({
  label,
  unit,
  tone,
  value,
  format,
  canEdit,
  onCommit,
  compact,
}: {
  label: string;
  unit?: string;
  tone: "accent" | "neutral";
  value: number;
  format: (v: number | null | undefined) => string;
  canEdit: boolean;
  onCommit: (raw: string) => Promise<boolean>;
  compact?: boolean;
}) {
  if (canEdit) return <SettingInput label={label} unit={unit === "tấn" ? "t" : unit} value={value} format={format} onCommit={onCommit} size={compact ? "sm" : "md"} />;
  if (compact)
    return (
      <p className="flex items-center justify-between rounded-lg bg-surface-3 px-3 py-1.5 text-xs text-muted">
        {label}
        <span className="num font-semibold text-fg">{format(value)}</span>
      </p>
    );
  return <BigValue label={label} value={format(value)} unit={unit} tone={tone} />;
}

function SiloPanel({
  name,
  mode,
  feeding,
  high,
  low,
  stock,
  counter,
  coeff,
  canEdit,
  onSaveStock,
  onSaveCoeff,
}: {
  name: "A" | "B";
  mode: 0 | 1 | null;
  feeding: boolean;
  high: Parameters<typeof levelFromSensors>[0];
  low: Parameters<typeof levelFromSensors>[1];
  stock: number;
  counter: number | null;
  coeff: number;
  canEdit: boolean;
  onSaveStock: (raw: string) => Promise<boolean>;
  onSaveCoeff: (raw: string) => Promise<boolean>;
}) {
  return (
    <Panel
      title={`Silo ${name}`}
      subtitle={feeding ? "Đang cấp liệu" : "Chờ"}
      right={
        <Badge tone={mode === 1 ? "brand" : mode === 0 ? "accent" : "neutral"} className="text-[11px]">
          {modeLabel(mode)}
        </Badge>
      }
    >
      <TankGauge fill={levelFromSensors(high, low)} tone={name === "A" ? "brand" : "accent"} high={high} low={low} feeding={feeding} caption="mức theo cảm biến" />
      <div className="grid grid-cols-2 gap-2">
        <ValueOrInput label={`Tồn ${name}`} unit="tấn" tone="accent" value={stock} format={fmt2} canEdit={canEdit} onCommit={onSaveStock} />
        <BigValue label={`Bộ đếm · ${modeLabel(mode, "Chưa chọn")}`} value={counter === null ? "--" : counter.toFixed(2)} tone="neutral" />
      </div>
      <ValueOrInput label={`Hệ số ${name}`} tone="neutral" value={coeff} format={fmtCoeff} canEdit={canEdit} onCommit={onSaveCoeff} compact />
    </Panel>
  );
}

function CurrentOrders({ orders }: { orders: Order[] }) {
  if (!orders.length) {
    return (
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-5 py-3 text-[13px] text-muted">
        <PackageOpen size={16} className="shrink-0 text-subtle" />
        Chưa có đơn đang chạy được gán cho máy này.
      </div>
    );
  }
  return (
    <div className="divide-y divide-line border-b border-line bg-surface-2">
      {orders.map((o) => {
        const qty = Number(o.quantity) || 0;
        const done = producedOf(o);
        const pct = qty > 0 ? Math.min(100, (done / qty) * 100) : 0;
        return (
          <div key={o.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Đơn hiện tại</p>
              <p className="truncate font-semibold text-fg">
                {o.orderNumber}
                <span className="ml-2 text-[13px] font-normal text-muted">
                  {[o.packagingCode, o.grainSize, o.stoneType].filter(Boolean).join(" · ") || "—"}
                </span>
              </p>
            </div>
            <div className="min-w-[200px] flex-1">
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span className="num">
                  {fmtNumber(done)} / {fmtNumber(qty)} tấn
                </span>
                <span className="num font-medium text-danger-600">Còn {fmtNumber(remainingOf(o))} t</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
