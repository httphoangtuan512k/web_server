"use client";

import { CheckCircle2, Inbox, PencilLine, Play, RotateCw } from "lucide-react";
import { useState } from "react";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { num, type OperatorPerms, type Order } from "./types";

type Tab = "paused" | "new";

export interface QueueHandlers {
  onStart: (o: Order) => void;
  onResume: (o: Order) => void;
  onComplete: (o: Order) => void;
  onEdit: (o: Order) => void;
}

/** Đơn tạm dừng (Chạy tiếp) và đơn mới chờ chạy (Bắt đầu chạy). */
export function QueueTable({ paused, waiting, perms, handlers }: { paused: Order[]; waiting: Order[]; perms: OperatorPerms; handlers: QueueHandlers }) {
  const [tab, setTab] = useState<Tab>("paused");
  const rows = tab === "paused" ? paused : waiting;

  return (
    <Card>
      <CardHeader
        icon={RotateCw}
        title="Hàng chờ vận hành"
        description="Đơn đang tạm dừng có thể chạy tiếp; đơn mới tạo có thể bắt đầu chạy trên máy."
        actions={
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "paused", label: "Tạm dừng", count: paused.length },
              { value: "new", label: "Chờ chạy", count: waiting.length },
            ]}
          />
        }
      />
      {rows.length ? (
        <Table maxHeight="520px">
          <THead>
            <tr>
              <Th>Số đơn</Th>
              <Th>Mã bao bì</Th>
              <Th>Cỡ hạt</Th>
              <Th>Loại đá</Th>
              <Th>Độ trắng</Th>
              <Th align="right">Tổng SL (t)</Th>
              {tab === "paused" ? <Th align="right">Đã chạy (t)</Th> : null}
              {tab === "paused" ? <Th>Máy</Th> : null}
              <Th>{tab === "paused" ? "Cập nhật" : "Ngày tạo"}</Th>
              <Th align="right">Thao tác</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map((o) => (
              <Tr key={o.id}>
                <Td className="font-semibold">{o.orderNumber}</Td>
                <Td>{o.packagingCode || "—"}</Td>
                <Td>{o.grainSize || "—"}</Td>
                <Td>{o.stoneType || "—"}</Td>
                <Td>{o.whiteness || "—"}</Td>
                <Td align="right">{fmtNumber(num(o.quantity))}</Td>
                {tab === "paused" ? <Td align="right">{fmtNumber(num(o.runOnMachine) + num(o.khoBu))}</Td> : null}
                {tab === "paused" ? <Td>{o.machineName || "—"}</Td> : null}
                <Td className="num text-muted">{fmtDateTime(tab === "paused" ? o.updatedAt : o.createdAt)}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    {tab === "paused" && perms.canOperate ? (
                      <Button size="md" variant="success" icon={Play} onClick={() => handlers.onResume(o)}>
                        Chạy tiếp
                      </Button>
                    ) : null}
                    {tab === "new" && perms.canOperate ? (
                      <Button size="md" icon={Play} onClick={() => handlers.onStart(o)}>
                        Bắt đầu chạy
                      </Button>
                    ) : null}
                    {tab === "paused" && perms.canConfirm ? (
                      <Button size="md" variant="secondary" icon={CheckCircle2} onClick={() => handlers.onComplete(o)}>
                        Hoàn thành
                      </Button>
                    ) : null}
                    {perms.isSuper ? (
                      <Button size="icon" variant="ghost" icon={PencilLine} onClick={() => handlers.onEdit(o)} aria-label="Sửa toàn bộ" title="Sửa toàn bộ" />
                    ) : null}
                    {!perms.canOperate && !perms.isSuper && !(tab === "paused" && perms.canConfirm) ? <span className="text-[13px] text-muted">Chỉ xem</span> : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={Inbox} title={tab === "paused" ? "Không có đơn đang tạm dừng." : "Không có đơn mới chờ chạy."} />
      )}
    </Card>
  );
}
