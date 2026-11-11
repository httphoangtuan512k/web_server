"use client";
/**
 * File này: bảng "Nhật ký vận hành gần đây" (50 thao tác mới nhất trên đơn hàng).
 * Dùng ở: cuối trang Xưởng vận hành.
 */

import { History } from "lucide-react";
import { useState } from "react";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import type { HistoryLog } from "./types";

/** Chọn màu nhãn theo tên thao tác: hoàn thành xanh, tạm dừng vàng, chạy xanh dương. */
function actionTone(action: string) {
  const a = action.toLowerCase();
  if (a.includes("hoàn thành")) return "success" as const;
  if (a.includes("tạm dừng")) return "warning" as const;
  if (a.includes("chạy")) return "brand" as const;
  return "neutral" as const;
}

/** Nhật ký vận hành gần đây – GET /api/history (50 dòng mới nhất). */
export function HistoryLogCard({ logs, error }: { logs: HistoryLog[] | null; error: string }) {
  // Mặc định hiện 10 dòng; bấm "Xem tất cả" để mở hết.
  const [expanded, setExpanded] = useState(false);
  const shown = logs ? (expanded ? logs : logs.slice(0, 10)) : [];
  return (
    <Card>
      {/* Tiêu đề thẻ */}
      <CardHeader icon={History} title="Nhật ký vận hành gần đây" description="50 thao tác mới nhất trên đơn hàng (bắt đầu, tạm dừng, chạy thêm máy, xác nhận…)." />
      {/* Lỗi / đang tải / trống / bảng nhật ký */}
      {error ? (
        <p className="px-5 py-6 text-sm text-danger-600">Không thể tải lịch sử: {error}</p>
      ) : !logs ? (
        <p className="px-5 py-6 text-sm text-muted">Đang tải…</p>
      ) : !logs.length ? (
        <EmptyState icon={History} title="Chưa có thao tác nào." />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>Thời gian</Th>
                <Th>Thao tác</Th>
                <Th>Số đơn</Th>
                <Th>Máy</Th>
                <Th>Người thực hiện</Th>
                <Th align="right">Cũ → Mới</Th>
              </tr>
            </THead>
            {/* Mỗi dòng: thời gian, thao tác, số đơn, máy, người làm, số cũ → mới */}
            <tbody>
              {shown.map((l) => (
                <Tr key={l.id}>
                  <Td className="num text-muted">{fmtDateTime(l.created_at)}</Td>
                  <Td>
                    <Badge tone={actionTone(l.action)}>{l.action}</Badge>
                  </Td>
                  <Td className="font-medium">{l.order_number || "—"}</Td>
                  <Td>{l.machine_name || "—"}</Td>
                  <Td>{l.user_name || "—"}</Td>
                  <Td align="right" className="text-muted">
                    {Number(l.old_value) || Number(l.new_value) ? `${fmtNumber(l.old_value)} → ${fmtNumber(l.new_value)}` : "—"}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {/* Nút Xem tất cả / Thu gọn khi nhiều hơn 10 dòng */}
          {logs.length > 10 ? (
            <div className="border-t border-line px-5 py-2.5 text-center">
              <Button size="sm" variant="ghost" onClick={() => setExpanded((x) => !x)}>
                {expanded ? "Thu gọn" : `Xem tất cả ${logs.length} dòng`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
