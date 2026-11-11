"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, Spinner } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { tlBtn } from "./tl-ui";
import type { DocHistoryItem, DocumentFile } from "./types";

export function HistoryModal({ doc, onClose }: { doc: DocumentFile; onClose: () => void }) {
  const [items, setItems] = useState<DocHistoryItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .get<{ history: DocHistoryItem[] }>(`/api/tai-lieu/${doc.id}/history`)
      .then((d) => alive && setItems(d.history || []))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [doc.id]);

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Lịch sử hoạt động"
      description={doc.original_name}
      footer={
        <button type="button" className={cn(tlBtn.base, tlBtn.md, tlBtn.gray)} onClick={onClose}>
          Đóng
        </button>
      }
    >
      {!items ? (
        error ? (
          <p className="py-6 text-center text-sm text-danger-600">{error}</p>
        ) : (
          <Spinner />
        )
      ) : !items.length ? (
        <EmptyState icon={History} title="Chưa có lịch sử hoạt động." />
      ) : (
        <div className="-mx-5 -my-4">
          <Table maxHeight="60dvh">
            <THead>
              <tr>
                <Th>Người thực hiện</Th>
                <Th>Hoạt động</Th>
                <Th>Thời gian</Th>
              </tr>
            </THead>
            <tbody>
              {items.map((x, i) => (
                <Tr key={i}>
                  <Td className="font-medium">{x.user_name}</Td>
                  <Td>{x.action}</Td>
                  <Td className="whitespace-nowrap text-muted">{fmtDateTime(x.created_at)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Modal>
  );
}
