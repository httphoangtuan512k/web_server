"use client";
// File này: bảng "Lịch sử đăng nhập tài khoản" có ô tìm kiếm và bộ lọc.
// Dùng ở: trang Người dùng, chỉ Super Admin thấy.

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { OgButton, OgCard, OgCardTitle, OgEmptyRow, ogInput, OgPill, OgTable, OgTd, OgTh, OgTr } from "../../_shared/og-button";
import { useApiData } from "../../_shared/use-api-data";
import { matchesQuery, normalizeText, shortUserAgent } from "../../_shared/utils";
import type { LoginSession } from "./types";

// Màu nhãn theo trạng thái phiên (xanh = đang hoạt động, xám = đã thoát, vàng = chưa rõ).
type Tone = "ok" | "muted" | "warn" | "default";
const STATUS_TONE: Record<string, Tone> = {
  "Đang hoạt động": "ok",
  "Đã đăng xuất": "muted",
  "Chưa ghi nhận đăng xuất": "warn",
  "Có thể đã hết phiên": "default",
};

// Tên vai trò hiển thị.
const roleLabel = (s: LoginSession) => (s.is_super ? "Super Admin" : s.role === "admin" ? "Quản trị viên" : "Nhân viên");

/** Lịch sử đăng nhập – chỉ Super Admin (GET /api/super/login-sessions, tối đa 500 phiên mới nhất). Cột & thứ tự như admin.html. */
export function LoginSessions() {
  const toast = useToast();
  // Tải danh sách phiên đăng nhập.
  const { data: rows, error, loading, reload } = useApiData<LoginSession[]>("/api/super/login-sessions");
  // Bộ lọc: người dùng, trạng thái, ô tìm kiếm.
  const [user, setUser] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  // Nút "Làm mới": tải lại, lỗi thì báo.
  const load = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  // Danh sách người dùng (không trùng, xếp theo tên) cho ô lọc.
  const users = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) if (!m.has(r.username)) m.set(r.username, r.full_name || r.username);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [rows]);

  // Các phiên khớp bộ lọc + từ khóa tìm kiếm.
  const filtered = useMemo(() => {
    const nq = normalizeText(q.trim());
    return (rows ?? []).filter(
      (r) => (!user || r.username === user) && (!status || r.status === status) && matchesQuery(nq, r.username, r.full_name, r.ip_address, r.user_agent),
    );
  }, [rows, user, status, q]);

  // Đếm số phiên đang hoạt động.
  const activeCount = useMemo(() => (rows ?? []).filter((r) => r.status === "Đang hoạt động").length, [rows]);

  return (
    <OgCard>
      {/* Tiêu đề + dòng thống kê + nút "Làm mới" */}
      <OgCardTitle
        title="Lịch sử đăng nhập tài khoản"
        help={
          <>
            Chỉ Super Admin xem được. Dữ liệu ghi nhận từ thời điểm cập nhật phiên bản này.
            {rows ? (
              <>
                {" "}
                · <b className="font-semibold text-[#1e293b]">{rows.length}</b> phiên gần nhất, <b className="font-semibold text-[#16794b]">{activeCount}</b> đang
                hoạt động.
              </>
            ) : null}
          </>
        }
        actions={
          <OgButton loading={loading} onClick={load}>
            Làm mới
          </OgButton>
        }
        className="mb-3.5!"
      />

      {/* Hàng bộ lọc: tìm kiếm, chọn người dùng, chọn trạng thái */}
      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_200px]">
        <input type="search" className={cn(ogInput, "min-h-10!")} placeholder="Tìm tài khoản, IP, thiết bị…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={cn(ogInput, "min-h-10!")} value={user} onChange={(e) => setUser(e.target.value)} aria-label="Lọc theo người dùng">
          <option value="">Tất cả người dùng</option>
          {users.map(([u, name]) => (
            <option key={u} value={u}>
              {name === u ? u : `${name} (${u})`}
            </option>
          ))}
        </select>
        <select className={cn(ogInput, "min-h-10!")} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc theo trạng thái">
          <option value="">Mọi trạng thái</option>
          {Object.keys(STATUS_TONE).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Bảng phiên đăng nhập (cuộn ngang trên điện thoại) */}
      <OgTable maxHeight="70vh" minWidth={1000}>
        <thead>
          <tr>
            <OgTh>Tài khoản</OgTh>
            <OgTh>Quyền</OgTh>
            <OgTh>Đăng nhập lúc</OgTh>
            <OgTh>Hoạt động gần nhất</OgTh>
            <OgTh>Đăng xuất lúc</OgTh>
            <OgTh>Trạng thái</OgTh>
            <OgTh>IP</OgTh>
            <OgTh>Thiết bị / Trình duyệt</OgTh>
          </tr>
        </thead>
        <tbody>
          {/* Lỗi / đang tải / không có kết quả / danh sách phiên */}
          {error && !rows ? (
            <OgEmptyRow colSpan={8} tone="error">
              {error}
            </OgEmptyRow>
          ) : !rows ? (
            <OgEmptyRow colSpan={8}>Đang tải...</OgEmptyRow>
          ) : !filtered.length ? (
            <OgEmptyRow colSpan={8}>{rows.length ? "Không có phiên phù hợp bộ lọc." : "Chưa có dữ liệu đăng nhập kể từ khi bật theo dõi."}</OgEmptyRow>
          ) : (
            filtered.map((r) => (
              <OgTr key={r.id}>
                <OgTd>
                  <p className="font-semibold">{r.full_name || r.username}</p>
                  <p className="text-xs text-[#64748b]">({r.username})</p>
                </OgTd>
                <OgTd className="whitespace-nowrap">{roleLabel(r)}</OgTd>
                <OgTd className="num whitespace-nowrap">{fmtDateTime(r.login_at, "-")}</OgTd>
                {/* Lần hoạt động cuối + "x phút trước" */}
                <OgTd className="whitespace-nowrap">
                  <span className="num">{fmtDateTime(r.last_seen_at, "-")}</span>
                  {r.last_seen_at ? <p className="text-xs text-[#64748b]">{fmtRelative(r.last_seen_at)}</p> : null}
                </OgTd>
                <OgTd className="num whitespace-nowrap text-[#475569]">{fmtDateTime(r.logout_at, "-")}</OgTd>
                <OgTd>
                  <OgPill tone={STATUS_TONE[r.status] ?? "muted"}>{r.status || "-"}</OgPill>
                </OgTd>
                <OgTd className="num font-mono text-xs whitespace-nowrap">{r.ip_address || "-"}</OgTd>
                {/* Trình duyệt rút gọn; rê chuột để xem đầy đủ */}
                <OgTd className="max-w-[280px]">
                  <span title={r.user_agent || undefined} className="block truncate text-[13px]">
                    {shortUserAgent(r.user_agent)}
                  </span>
                </OgTd>
              </OgTr>
            ))
          )}
        </tbody>
      </OgTable>
    </OgCard>
  );
}
