"use client";

import { Cable, Check, Copy, EyeOff, KeyRound, PlugZap, RefreshCw, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, Spinner } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Callout } from "../../_shared/callout";
import { useApiData } from "../../_shared/use-api-data";
import { useVisibleInterval } from "../../_shared/use-visible-interval";
import { copyText } from "../../_shared/utils";
import type { PlcDeviceStatus, PlcKeyResponse } from "./types";

function ConnectionBadge({ s }: { s: PlcDeviceStatus }) {
  if (s.connected)
    return (
      <Badge tone="success" dot>
        Online
      </Badge>
    );
  if (s.last_received_at)
    return (
      <Badge tone="danger" dot>
        Mất kết nối
      </Badge>
    );
  return (
    <Badge tone="neutral" dot>
      Chưa kết nối
    </Badge>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-right text-sm text-fg">{children}</dd>
    </div>
  );
}

/** Quản lý API Key cho phần mềm C# trên máy B (chỉ Super Admin). */
export function PlcDeviceCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: s, error, loading, reload } = useApiData<PlcDeviceStatus>("/api/superadmin/plc-device");
  const [busy, setBusy] = useState<"" | "create" | "revoke">("");
  const [newKey, setNewKey] = useState<PlcKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Cập nhật trạng thái kết nối định kỳ (dừng khi tab ẩn).
  useVisibleInterval(() => void reload(), 5000);

  async function createKey() {
    const ok = await confirm({
      title: s?.key_active ? "Cấp lại API Key mới?" : "Tạo API Key cho máy B?",
      message: s?.key_active
        ? "Khóa hiện tại sẽ mất hiệu lực ngay. Phần mềm C# trên máy B phải được cập nhật khóa mới mới gửi được dữ liệu."
        : "Khóa chỉ hiển thị một lần sau khi tạo. Hãy chuẩn bị lưu vào phần mềm C#.",
      confirmText: s?.key_active ? "Cấp lại khóa" : "Tạo khóa",
      danger: !!s?.key_active,
    });
    if (!ok) return;
    setBusy("create");
    try {
      const r = await api.post<PlcKeyResponse>("/api/superadmin/plc-device/key");
      setNewKey(r);
      setCopied(false);
      toast.success("Đã tạo API Key. Hãy sao chép và lưu lại ngay.");
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy("");
    }
  }

  async function revokeKey() {
    const ok = await confirm({
      title: "Thu hồi API Key của máy B?",
      message: "Phần mềm C# sẽ không gửi được dữ liệu PLC nữa cho đến khi được cấp khóa mới.",
      confirmText: "Thu hồi khóa",
      danger: true,
    });
    if (!ok) return;
    setBusy("revoke");
    try {
      await api.delete("/api/superadmin/plc-device/key");
      setNewKey(null);
      toast.success("Đã thu hồi API Key.");
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    if (!newKey) return;
    if (await copyText(newKey.api_key)) {
      setCopied(true);
      toast.success("Đã sao chép API Key.");
    } else toast.error("Không sao chép được. Hãy chọn và sao chép thủ công.");
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Cable}
        title="Kết nối PLC – Máy B"
        description="Cấp API Key cho phần mềm C# trên máy B để gửi dữ liệu PLC lên hệ thống."
        actions={
          <Button
            variant="ghost"
            size="icon"
            icon={RefreshCw}
            loading={loading && !s}
            onClick={async () => {
              const err = await reload();
              if (err) toast.error(err);
            }}
            aria-label="Làm mới"
            title="Làm mới"
          />
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-5">
        {!s ? (
          error ? (
            <p className="py-6 text-center text-sm text-danger-600">{error}</p>
          ) : (
            <Spinner />
          )
        ) : (
          <>
            <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-2 p-4">
              <span
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                  s.connected ? "bg-success-50 text-success-600" : s.last_received_at ? "bg-danger-50 text-danger-600" : "bg-surface-3 text-subtle",
                )}
              >
                <PlugZap size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{s.device_id || "MAY_B"}</p>
                  <ConnectionBadge s={s} />
                </div>
                <p className="mt-0.5 text-[13px] text-muted">
                  {s.last_received_at ? (
                    <>
                      Nhận dữ liệu cuối <span className="font-medium text-fg">{fmtRelative(s.last_received_at)}</span>
                      <span className="num"> · {fmtDateTime(s.last_received_at)}</span>
                    </>
                  ) : (
                    "Chưa nhận được dữ liệu từ máy B."
                  )}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-line">
              <Row label="API Key">
                {s.key_active ? (
                  <Badge tone="success">Đang hoạt động</Badge>
                ) : s.key_revoked_at ? (
                  <Badge tone="danger">Đã thu hồi</Badge>
                ) : (
                  <Badge tone="neutral">Chưa tạo</Badge>
                )}
              </Row>
              {s.key_active ? (
                <Row label="Tạo lúc">
                  <span className="num">{fmtDateTime(s.key_created_at, "Không rõ")}</span>
                </Row>
              ) : s.key_revoked_at ? (
                <Row label="Thu hồi lúc">
                  <span className="num">{fmtDateTime(s.key_revoked_at)}</span>
                </Row>
              ) : null}
              <Row label="Endpoint nhận dữ liệu">
                <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs">POST /api/plc/telemetry</code>
              </Row>
              <Row label="Header xác thực">
                <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs">x-api-key</code>
              </Row>
              <Row label="Chu kỳ gửi dự kiến">1 giây</Row>
            </dl>

            {!s.key_active && !newKey ? (
              <Callout tone="info">Chưa có API Key hoạt động. Hãy tạo khóa cho máy B.</Callout>
            ) : null}

            {newKey ? (
              <div className="rounded-xl border border-warning-600/40 bg-warning-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warning-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-fg">API Key mới – chỉ hiển thị lần này</p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      Hãy sao chép và lưu vào phần mềm C#. Nếu đóng hoặc tải lại trang, khóa sẽ không hiển thị lại.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={newKey.api_key}
                    onFocus={(e) => e.currentTarget.select()}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="API Key mới"
                    className="h-10 min-w-0 flex-1 rounded-[10px] border border-line-strong bg-surface px-3 font-mono text-[13px] text-fg focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 focus:outline-none"
                  />
                  <Button variant={copied ? "success" : "primary"} icon={copied ? Check : Copy} onClick={copy}>
                    {copied ? "Đã sao chép" : "Sao chép"}
                  </Button>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" icon={EyeOff} onClick={() => setNewKey(null)}>
                    Tôi đã lưu, ẩn khóa
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
        <Button variant="secondary" className="hover:text-danger-600" icon={KeyRound} disabled={!s?.key_active || !!busy} loading={busy === "revoke"} onClick={revokeKey}>
          Thu hồi API Key
        </Button>
        <Button icon={KeyRound} disabled={!s || !!busy} loading={busy === "create"} onClick={createKey}>
          {s?.key_active ? "Cấp lại API Key" : "Tạo API Key"}
        </Button>
      </div>
    </Card>
  );
}
