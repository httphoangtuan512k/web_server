"use client";

/* eslint-disable @next/next/no-img-element */
import { CalendarClock, ImageOff, Pencil, Trash2, UserRound } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { afterImageOf, faultImageOf, type MaintenanceRecord } from "./types";

function Thumb({ src, alt, onOpen }: { src: string; alt: string; onOpen: (src: string, alt: string) => void }) {
  if (!src)
    return (
      <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl border border-dashed border-line-strong bg-surface-2 text-subtle sm:h-28 sm:w-28">
        <ImageOff size={18} />
      </div>
    );
  return (
    <button
      type="button"
      onClick={() => onOpen(src, alt)}
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-3 sm:h-28 sm:w-28"
      aria-label={`Xem ${alt.toLowerCase()}`}
    >
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
    </button>
  );
}

function Block({ label, tone, text, image, imageAlt, onOpen }: { label: string; tone: "danger" | "success"; text: React.ReactNode; image: string; imageAlt: string; onOpen: (src: string, alt: string) => void }) {
  return (
    <div className="flex min-w-0 gap-3">
      <Thumb src={image} alt={imageAlt} onOpen={onOpen} />
      <div className="min-w-0 flex-1">
        <p className={tone === "danger" ? "text-[11px] font-semibold tracking-wide text-danger-600 uppercase" : "text-[11px] font-semibold tracking-wide text-success-700 uppercase"}>
          {label}
        </p>
        <div className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap text-fg [overflow-wrap:anywhere]">{text}</div>
      </div>
    </div>
  );
}

export function RecordCard({
  record: r,
  canManage,
  onOpenImage,
  onEdit,
  onDelete,
}: {
  record: MaintenanceRecord;
  canManage: boolean;
  onOpenImage: (src: string, alt: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const repaired = !!(r.repair_content || r.after_status).trim();
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-fg">{r.equipment}</h3>
            {repaired ? (
              <Badge tone="success" dot>
                Đã xử lý
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Chờ sửa chữa
              </Badge>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={12} /> {fmtDateTime(r.created_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound size={12} /> {r.created_by || "—"}
            </span>
            {r.updated_at ? <span className="text-subtle">Sửa lúc {fmtDateTime(r.updated_at)}</span> : null}
          </p>
        </div>
        {canManage ? (
          <div className="flex shrink-0 gap-1">
            <Button size="icon" variant="ghost" icon={Pencil} aria-label="Sửa" title="Sửa" onClick={onEdit} />
            <Button size="icon" variant="ghost" icon={Trash2} aria-label="Xóa" title="Xóa" className="text-danger-600 hover:bg-danger-50 hover:text-danger-700" onClick={onDelete} />
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <Block label="Hư hỏng" tone="danger" text={r.fault_description} image={faultImageOf(r)} imageAlt={`Ảnh hư hỏng – ${r.equipment}`} onOpen={onOpenImage} />
        <Block
          label="Sửa chữa"
          tone="success"
          image={afterImageOf(r)}
          imageAlt={`Ảnh sau sửa – ${r.equipment}`}
          onOpen={onOpenImage}
          text={
            <>
              {r.repair_content ? <p>{r.repair_content}</p> : <p className="text-subtle">Chưa có nội dung sửa chữa.</p>}
              {r.after_status ? (
                <p className="mt-1.5 text-muted">
                  <span className="font-medium text-fg">Sau sửa:</span> {r.after_status}
                </p>
              ) : null}
            </>
          }
        />
      </div>
    </Card>
  );
}
