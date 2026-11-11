import { cn } from "@/lib/cn";
import type { Signal } from "../_shared/plc";

/** Đèn cảm biến mức liệu: 1 = có liệu (đỏ), 0 = không (viền xanh), khác = không rõ (xám). */
export function SensorDot({ signal, label }: { signal: Signal; label: string }) {
  const text = signal === "on" ? "Có liệu" : signal === "off" ? "Không" : "Không rõ";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] leading-none whitespace-nowrap text-muted" title={`${label}: ${text}`}>
      <span
        className={cn(
          "inline-block h-3 w-3 shrink-0 rounded-full",
          signal === "on" && "bg-danger-600 ring-2 ring-danger-600/30",
          signal === "off" && "bg-surface ring-2 ring-success-600 ring-inset",
          signal === "unknown" && "bg-line-strong",
        )}
      />
      {label}
    </span>
  );
}

/**
 * Bồn chứa dạng đứng (phễu/silo) vẽ bằng CSS.
 * `fill` 0..1 (null = không xác định). Hai cảm biến mức cao/thấp gắn bên phải đúng vị trí.
 */
export function TankGauge({
  fill,
  tone = "brand",
  high,
  low,
  feeding,
  shape = "silo",
  caption,
}: {
  fill: number | null;
  tone?: "brand" | "accent";
  high: Signal;
  low: Signal;
  feeding?: boolean;
  shape?: "silo" | "hopper";
  caption?: string;
}) {
  const pct = fill === null ? null : Math.round(Math.min(1, Math.max(0, fill)) * 100);
  const fillCls = tone === "accent" ? "bg-accent-500/25 border-accent-500" : "bg-brand-500/25 border-brand-500";
  return (
    <div className="flex items-stretch gap-2">
      <div className="relative w-16 shrink-0 sm:w-[72px]">
        {/* Dòng cấp liệu vào bồn */}
        <svg viewBox="0 0 24 18" className={cn("mx-auto mb-0.5 h-[18px] w-6", feeding ? "text-success-600" : "text-line-strong")} aria-hidden>
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M5 ${2 + i * 5} L12 ${6 + i * 5} L19 ${2 + i * 5}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              {feeding ? <animate attributeName="opacity" values="0.15;1;0.15" dur="0.9s" begin={`${i * 0.3}s`} repeatCount="indefinite" /> : null}
            </path>
          ))}
        </svg>
        <div
          className={cn(
            "relative h-32 overflow-hidden border-2 border-line-strong bg-surface-2",
            shape === "hopper" ? "rounded-t-md rounded-b-[28px]" : "rounded-t-[18px] rounded-b-md",
          )}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
          aria-label={caption}
        >
          {[25, 50, 75].map((g) => (
            <span key={g} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${g}%` }} />
          ))}
          {pct === null ? (
            <span className="absolute inset-0 grid place-items-center text-[11px] text-subtle">—</span>
          ) : (
            <span className={cn("absolute inset-x-0 bottom-0 border-t-2 transition-[height] duration-700 ease-out", fillCls)} style={{ height: `${pct}%` }} />
          )}
        </div>
        {caption ? <p className="num mt-1 text-center text-[11px] text-subtle">{caption}</p> : null}
      </div>
      {/* Cảm biến: cao ở ~20%, thấp ở ~75% chiều cao bồn */}
      <div className="relative min-w-0 flex-1 pt-[18px]">
        <div className="relative h-32">
          <span className="absolute top-[18%] left-0 -translate-y-1/2">
            <SensorDot signal={high} label="Cao" />
          </span>
          <span className="absolute top-[78%] left-0 -translate-y-1/2">
            <SensorDot signal={low} label="Thấp" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Ước lượng mức silo từ 2 cảm biến (không có cảm biến liên tục). */
export function levelFromSensors(high: Signal, low: Signal): number | null {
  if (high === "on") return 0.92;
  if (low === "on") return 0.5;
  if (low === "off") return 0.1;
  if (high === "off") return 0.4;
  return null;
}
