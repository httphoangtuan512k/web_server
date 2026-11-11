"use client";

/* eslint-disable @next/next/no-img-element */
import { ExternalLink } from "lucide-react";
import { Modal } from "@/components/ui/modal";

/** Xem ảnh lớn (bấm ra ngoài / Esc để đóng). */
export function ImageViewer({ image, onClose }: { image: { src: string; alt: string } | null; onClose: () => void }) {
  return (
    <Modal open={!!image} onClose={onClose} size="xl" title={image?.alt || "Ảnh"}>
      {image ? (
        <div className="flex flex-col items-center gap-3">
          <img src={image.src} alt={image.alt} className="max-h-[72dvh] w-auto max-w-full rounded-lg bg-surface-3 object-contain" />
          {!image.src.startsWith("data:") ? (
            <a href={image.src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:underline">
              <ExternalLink size={14} /> Mở ảnh gốc trong tab mới
            </a>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
