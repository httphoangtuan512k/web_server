"use client";
/**
 * File này: hộp xem ảnh bao bì của đơn hàng cỡ lớn.
 * Dùng ở: trang Kế hoạch, khi bấm vào ảnh đơn.
 */

import { ExternalLink } from "lucide-react";
import { Modal } from "@/components/ui/modal";

/** Xem ảnh bao bì cỡ lớn. */
export function ImageViewer({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  return (
    // Hộp thoại toàn màn hình; chân hộp có nút "Mở ảnh gốc" (mở tab mới).
    <Modal
      open
      onClose={onClose}
      size="full"
      title={`Hình ảnh: ${title}`}
      footer={
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-medium text-fg shadow-sm hover:bg-surface-3"
        >
          <ExternalLink size={17} />
          Mở ảnh gốc
        </a>
      }
    >
      {/* Ảnh lớn ở giữa; bấm vào ảnh để đóng. */}
      <button
        type="button"
        onClick={onClose}
        className="grid min-h-[50dvh] w-full cursor-zoom-out place-items-center rounded-xl bg-surface-3"
        aria-label="Đóng ảnh"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title} className="max-h-[72dvh] max-w-full object-contain" />
      </button>
    </Modal>
  );
}
