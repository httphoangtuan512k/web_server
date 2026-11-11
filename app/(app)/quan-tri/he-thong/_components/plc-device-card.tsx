"use client";
// File này: thẻ "Quản lý kết nối PLC – Máy B": xem trạng thái kết nối, tạo/cấp lại/thu hồi API Key.
// Dùng ở: trang Hệ thống (chỉ Super Admin).

import { PlugZap } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { useConfirm } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { OgButton, OgCard, OgCardTitle, ogInput, OgPill } from "../../_shared/og-button";
import { useApiData } from "../../_shared/use-api-data";
import { useVisibleInterval } from "../../_shared/use-visible-interval";
import { copyText } from "../../_shared/utils";
import type { PlcDeviceStatus, PlcKeyResponse } from "./types";

// Chữ trạng thái: Online / Mất kết nối / Chưa kết nối.
const connText = (s: PlcDeviceStatus) => (s.connected ? "Online" : s.last_received_at ? "Mất kết nối" : "Chưa kết nối");

// Một dòng thông tin: nhãn bên trái, giá trị bên phải.
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-[#edf0f4] py-2.5 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-[#64748b]">{label}</dt>
      <dd className="min-w-0 text-right text-sm break-words text-[#1e293b]">{children}</dd>
    </div>
  );
}

/** "Quản lý kết nối PLC – Máy B" như admin.html cũ: cấp / thu hồi API Key cho phần mềm C# (chỉ Super Admin). */
export function PlcDeviceCard() {
  const toast = useToast();
  const confirm = useConfirm();
  // Tải trạng thái thiết bị PLC.
  const { data: s, error, loading, reload } = useApiData<PlcDeviceStatus>("/api/superadmin/plc-device");
  // Đang tạo/thu hồi; key vừa tạo (chỉ hiện 1 lần); đã sao chép chưa.
  const [busy, setBusy] = useState<"" | "create" | "revoke">("");
  const [newKey, setNewKey] = useState<PlcKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Cập nhật trạng thái kết nối định kỳ (dừng khi tab ẩn).
  useVisibleInterval(() => void reload(), 5000);

  // Tạo/cấp lại key: hỏi xác nhận, gọi máy chủ, hiện key mới.
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

  // Thu hồi key: hỏi xác nhận, gọi máy chủ, ẩn key.
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

  // Sao chép key mới vào bộ nhớ tạm.
  async function copy() {
    if (!newKey) return;
    if (await copyText(newKey.api_key)) {
      setCopied(true);
      toast.success("Đã sao chép API Key.");
    } else toast.error("Không sao chép được. Hãy chọn và sao chép thủ công.");
  }

  return (
    <OgCard>
      {/* Tiêu đề + nút Làm mới */}
      <OgCardTitle
        title="Quản lý kết nối PLC – Máy B"
        help="Cấp API Key cho phần mềm C# trên máy B để gửi dữ liệu PLC lên SUPER WHITE."
        actions={
          <OgButton
            size="sm"
            loading={loading && !s}
            onClick={async () => {
              const err = await reload();
              if (err) toast.error(err);
            }}
          >
            Làm mới
          </OgButton>
        }
      />

      {/* Chưa có dữ liệu: hiện đang tải hoặc lỗi */}
      {!s ? (
        <p className={cn("rounded-lg border border-dashed border-[#dce3e9] px-4 py-6 text-center text-sm", error ? "text-[#b42318]" : "text-[#64748b]")}>
          {error || "Đang tải trạng thái..."}
        </p>
      ) : (
        <>
          {/* Dòng trạng thái như trang cũ */}
          <p className="mb-4 text-xs leading-relaxed text-[#64748b]">
            {s.key_active
              ? `API Key đang hoạt động. Tạo lúc: ${fmtDateTime(s.key_created_at, "Không rõ")} · Trạng thái máy B: ${connText(s)}${
                  s.last_received_at ? ` · Nhận dữ liệu cuối: ${fmtDateTime(s.last_received_at)}` : ""
                }`
              : "Chưa có API Key hoạt động. Hãy tạo khóa cho máy B."}
          </p>

          {/* Hai khối: trạng thái máy B (trái) và thông tin key (phải) */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="flex items-center gap-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
              {/* Vòng tròn biểu tượng: xanh = online, đỏ = mất kết nối, xám = chưa kết nối */}
              <span
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-full",
                  s.connected ? "bg-[#ecfdf3] text-[#16794b]" : s.last_received_at ? "bg-[#fce8e6] text-[#b42318]" : "bg-[#eef2f7] text-[#64748b]",
                )}
              >
                <PlugZap size={22} />
              </span>
              <div className="min-w-0 flex-1">
                {/* Tên thiết bị + nhãn trạng thái */}
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{s.device_id || "MAY_B"}</p>
                  <OgPill tone={s.connected ? "ok" : s.last_received_at ? "off" : "muted"}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {connText(s)}
                  </OgPill>
                </div>
                {/* Lần nhận dữ liệu cuối */}
                <p className="mt-1 text-[13px] text-[#64748b]">
                  {s.last_received_at ? (
                    <>
                      Nhận dữ liệu cuối <b className="font-semibold text-[#1e293b]">{fmtRelative(s.last_received_at)}</b>
                      <span className="num"> · {fmtDateTime(s.last_received_at)}</span>
                    </>
                  ) : (
                    "Chưa nhận được dữ liệu từ máy B."
                  )}
                </p>
              </div>
            </div>

            {/* Bảng thông tin key */}
            <dl className="rounded-lg border border-[#e2e8f0] px-4 py-1">
              <Row label="API Key">
                {s.key_active ? <OgPill tone="ok">Đang hoạt động</OgPill> : s.key_revoked_at ? <OgPill tone="off">Đã thu hồi</OgPill> : <OgPill tone="muted">Chưa tạo</OgPill>}
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
              <Row label="Header xác thực">
                <code className="rounded bg-[#eef2f7] px-1.5 py-0.5 font-mono text-xs">x-api-key</code>
              </Row>
            </dl>
          </div>

          {/* Key mới tạo: ô chứa key + nút sao chép / ẩn */}
          {newKey ? (
            <div className="mt-4 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-4">
              <strong className="text-sm">API Key mới – chỉ hiển thị lần này</strong>
              <p className="mt-1 text-xs text-[#64748b]">Hãy sao chép và lưu vào phần mềm C#. Nếu đóng hoặc tải lại trang, khóa sẽ không hiển thị lại.</p>
              <input
                readOnly
                value={newKey.api_key}
                onFocus={(e) => e.currentTarget.select()}
                autoComplete="off"
                spellCheck={false}
                aria-label="API Key mới"
                className={cn(ogInput, "mt-3 font-mono text-[13px]")}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <OgButton variant={copied ? "success" : "default"} onClick={copy}>
                  {copied ? "✔ Đã sao chép" : "Sao chép API Key"}
                </OgButton>
                <OgButton onClick={() => setNewKey(null)}>Tôi đã lưu, ẩn khóa</OgButton>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Nút Tạo/Cấp lại và Thu hồi API Key */}
      <div className="mt-4 flex flex-wrap gap-2">
        <OgButton variant="primary" disabled={!s || !!busy} loading={busy === "create"} onClick={createKey}>
          Tạo / Cấp lại API Key
        </OgButton>
        <OgButton variant="danger" disabled={!s?.key_active || !!busy} loading={busy === "revoke"} onClick={revokeKey}>
          Thu hồi API Key
        </OgButton>
      </div>
      {/* Ghi chú: tên thiết bị, địa chỉ API, chu kỳ gửi */}
      <p className="mt-3 text-xs text-[#64748b]">
        Thiết bị: {s?.device_id || "MAY_B"} · API nhận dữ liệu: <code className="font-mono">/api/plc/telemetry</code> · Chu kỳ dự kiến: 1 giây.
      </p>
    </OgCard>
  );
}
