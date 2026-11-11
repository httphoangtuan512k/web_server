"use client";

import { cn } from "@/lib/cn";
import type { Signal } from "../_shared/plc";
import { modeLabel, type ScadaView } from "./scada";
import "./scada.css";
import { DraftInput } from "./setting-input";
import type { PlcMachineId, PlcStateKey } from "./types";

/** Ảnh sơ đồ gốc trích từ vanhanh.html (1019×570, hai máy dùng chung một ảnh). */
const SCADA_IMAGE = "/scada/so-do-may-nghien.png";
const NO_PERMISSION = "Tài khoản chưa được cấp quyền vận hành máy.";

const valid = (v: number | null | undefined) => v !== null && v !== undefined && Number.isFinite(Number(v));
const fmt2 = (v: number | null | undefined) => (valid(v) ? Number(v).toFixed(2) : "0.00");
const fmtCoeff = (v: number | null | undefined) => (valid(v) ? String(Number(v)) : "1");

const dotClass = (sig: Signal) => cn("scd-dot", sig === "on" ? "scd-dot-on" : sig === "off" ? "scd-dot-off" : "scd-dot-unknown");

/**
 * Sơ đồ phễu → máy nghiền → silo A/B: ảnh gốc + đèn cảm biến (SVG, cùng viewBox 1019×570)
 * + các ô số liệu đặt đè đúng vị trí bản gốc. Ô nhập lưu khi rời ô / Enter.
 */
export function ScadaDiagram({
  machine,
  view,
  canEdit,
  onSave,
}: {
  machine: PlcMachineId;
  view: ScadaView;
  canEdit: boolean;
  onSave: (key: PlcStateKey, raw: string) => Promise<boolean>;
}) {
  const st = view.state;
  const running = view.run === "running";
  const live = view.run === "running" || view.run === "stopped";
  const feedingA = view.feedA && !view.feedB;
  const feedingB = view.feedB && !view.feedA;
  const clipId = `scada-bars-${machine}`;
  // Khi chưa có dữ liệu sống giữ nhãn mặc định như trang cũ (JB / Đóng bao).
  const labelA = live ? modeLabel(view.modeA, "CHƯA CHỌN") : "JB";
  const labelB = live ? modeLabel(view.modeB, "CHƯA CHỌN") : "Đóng bao";
  const lock = canEdit ? undefined : NO_PERMISSION;

  const bare = (key: PlcStateKey, label: string, format: (v: number | null | undefined) => string) => (
    <DraftInput aria-label={label} value={st[key]} format={format} onCommit={(raw) => onSave(key, raw)} disabled={!canEdit} title={lock ?? label} className="scd-bare-input" />
  );

  return (
    <div className="mx-auto w-full max-w-[700px] xl:max-w-none">
      <div className="scd-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SCADA_IMAGE} alt="Sơ đồ phễu, máy nghiền và hai silo" width={1019} height={570} className="scd-img" draggable={false} />

        <svg className="scd-svg" viewBox="0 0 1019 570" preserveAspectRatio="none" aria-hidden>
          <circle className={dotClass(view.sensors.hopperHigh)} cx="83" cy="49" r="12" />
          <circle className={dotClass(view.sensors.hopperLow)} cx="83" cy="181" r="12" />
          <circle className={dotClass(view.sensors.siloAHigh)} cx="700" cy="264" r="12" />
          <circle className={dotClass(view.sensors.siloALow)} cx="700" cy="433" r="12" />
          <circle className={dotClass(view.sensors.siloBHigh)} cx="936" cy="264" r="12" />
          <circle className={dotClass(view.sensors.siloBLow)} cx="936" cy="433" r="12" />
          <defs>
            <clipPath id={clipId}>
              <rect x="275" y="445" width="150" height="108" rx="15" />
            </clipPath>
          </defs>
          <g className={cn("scd-cylinder", running && "scd-cylinder-on")} clipPath={`url(#${clipId})`}>
            <rect x="275" y="451" width="150" height="103" rx="18" fill="#263b56" stroke="#64748b" strokeWidth="4" />
            <ellipse cx="350" cy="453" rx="74" ry="15" fill="#9fb1c7" stroke="#334155" strokeWidth="4" />
            <g className="scd-ribs" stroke="#b8c8d9" strokeWidth="7" opacity=".9">
              <path d="M300 461V548 M324 459V550 M348 458V551 M372 458V551 M396 459V550 M420 461V548 M444 461V548" />
            </g>
            <ellipse cx="350" cy="550" rx="72" ry="12" fill="#263b56" stroke="#64748b" strokeWidth="3" />
          </g>
          {/* Sản lượng = tag Cân định lượng */}
          <rect x="69" y="291" width="55" height="30" rx="1" fill="#fff" stroke="#16a34a" strokeWidth="1.5" />
          <text className="scd-production" x="96" y="316">
            {view.production === null ? "--" : view.production.toFixed(2)}
          </text>
          <path className={cn("scd-spiral", feedingA && "scd-spiral-active")} d="M700 164 C684 172 716 180 700 188 C684 196 716 204 700 212" />
          <path className={cn("scd-spiral", feedingB && "scd-spiral-active")} d="M936 164 C920 172 952 180 936 188 C920 196 952 204 936 212" />
        </svg>

        <div className="scd-overlay">
          <div className="scd-box scd-hopper-setpoint">{bare("hopperSetpoint", "Mức đầy phễu", fmt2)}</div>
          <div className="scd-box scd-stock scd-hopper-stock">
            {bare("hopper", "Tồn phễu thực tế", fmt2)}
            <small>tấn</small>
          </div>
          <div className="scd-box scd-stock scd-stock-a">
            {bare("stockA", "Tồn silo A", fmt2)}
            <small>Tồn A · tấn</small>
          </div>
          <div className="scd-box scd-stock scd-stock-b">
            {bare("stockB", "Tồn silo B", fmt2)}
            <small>Tồn B · tấn</small>
          </div>
          <div className="scd-box scd-counter scd-counter-a" title={`Bộ đếm silo A · ${feedingA ? "đang cấp" : "chờ"}`}>
            <span className="num">{view.counterA === null ? "--" : view.counterA.toFixed(2)}</span>
            <small>{labelA}</small>
          </div>
          <div className="scd-box scd-counter scd-counter-b" title={`Bộ đếm silo B · ${feedingB ? "đang cấp" : "chờ"}`}>
            <span className="num">{view.counterB === null ? "--" : view.counterB.toFixed(2)}</span>
            <small>{labelB}</small>
          </div>
          <div className="scd-box scd-coeff scd-coeff-a">
            <DraftInput aria-label="Hệ số A" value={st.coeffA} format={fmtCoeff} onCommit={(raw) => onSave("coeffA", raw)} disabled={!canEdit} title={lock ?? "Hệ số A"} />
          </div>
          <div className="scd-box scd-coeff scd-coeff-b">
            <DraftInput aria-label="Hệ số B" value={st.coeffB} format={fmtCoeff} onCommit={(raw) => onSave("coeffB", raw)} disabled={!canEdit} title={lock ?? "Hệ số B"} />
          </div>
        </div>
      </div>
    </div>
  );
}
