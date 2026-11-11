"use client";

import { MonitorSmartphone, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, Spinner } from "@/components/ui/card";
import { SearchInput, Select } from "@/components/ui/form";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useApiData } from "../../_shared/use-api-data";
import { matchesQuery, normalizeText, shortUserAgent } from "../../_shared/utils";
import type { LoginSession } from "./types";

type Tone = "success" | "neutral" | "warning" | "info";
const STATUS_TONE: Record<string, Tone> = {
  "Đang hoạt động": "success",
  "Đã đăng xuất": "neutral",
  "Chưa ghi nhận đăng xuất": "warning",
  "Có thể đã hết phiên": "info",
};

const roleLabel = (s: LoginSession) => (s.is_super ? "Super Admin" : s.role === "admin" ? "Quản trị viên" : "Nhân viên");

/** Lịch sử đăng nhập – chỉ Super Admin (GET /api/super/login-sessions, tối đa 500 phiên mới nhất). */
export function LoginSessions() {
  const toast = useToast();
  const { data: rows, error, loading, reload } = useApiData<LoginSession[]>("/api/super/login-sessions");
  const [user, setUser] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    const err = await reload();
    if (err) toast.error(err);
  };

  const users = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) if (!m.has(r.username)) m.set(r.username, r.full_name || r.username);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [rows]);

  const filtered = useMemo(() => {
    const nq = normalizeText(q.trim());
    return (rows ?? []).filter(
      (r) => (!user || r.username === user) && (!status || r.status === status) && matchesQuery(nq, r.username, r.full_name, r.ip_address, r.user_agent),
    );
  }, [rows, user, status, q]);

  const activeCount = useMemo(() => (rows ?? []).filter((r) => r.status === "Đang hoạt động").length, [rows]);

  return (
    <Card>
      <CardHeader
        icon={MonitorSmartphone}
        title="Lịch sử đăng nhập tài khoản"
        description={
          rows ? `${rows.length} phiên gần nhất · ${activeCount} đang hoạt động. Chỉ Super Admin xem được.` : "Chỉ Super Admin xem được."
        }
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={load}>
            Làm mới
          </Button>
        }
      />
      <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-[minmax(0,1fr)_200px_200px] sm:px-5">
        <SearchInput placeholder="Tìm tài khoản, IP, thiết bị…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={user} onChange={(e) => setUser(e.target.value)} aria-label="Lọc theo người dùng">
          <option value="">Tất cả người dùng</option>
          {users.map(([u, name]) => (
            <option key={u} value={u}>
              {name === u ? u : `${name} (${u})`}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc theo trạng thái">
          <option value="">Mọi trạng thái</option>
          {Object.keys(STATUS_TONE).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {error && !rows ? (
        <p className="px-5 py-8 text-center text-sm text-danger-600">{error}</p>
      ) : !rows ? (
        <Spinner />
      ) : !filtered.length ? (
        <EmptyState
          icon={MonitorSmartphone}
          title={rows.length ? "Không có phiên phù hợp bộ lọc" : "Chưa có dữ liệu đăng nhập"}
          description={rows.length ? undefined : "Dữ liệu được ghi nhận kể từ khi bật theo dõi phiên đăng nhập."}
        />
      ) : (
        <Table maxHeight="70vh">
          <THead>
            <tr>
              <Th>Tài khoản</Th>
              <Th>Quyền</Th>
              <Th>Đăng nhập lúc</Th>
              <Th>Hoạt động gần nhất</Th>
              <Th>Đăng xuất lúc</Th>
              <Th>Trạng thái</Th>
              <Th>IP</Th>
              <Th>Thiết bị / Trình duyệt</Th>
            </tr>
          </THead>
          <tbody>
            {filtered.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <p className="font-medium">{r.full_name || r.username}</p>
                  <p className="text-xs text-muted">@{r.username}</p>
                </Td>
                <Td className="text-muted">{roleLabel(r)}</Td>
                <Td className="num whitespace-nowrap">{fmtDateTime(r.login_at)}</Td>
                <Td className="whitespace-nowrap">
                  <span className="num">{fmtDateTime(r.last_seen_at)}</span>
                  {r.last_seen_at ? <p className="text-xs text-muted">{fmtRelative(r.last_seen_at)}</p> : null}
                </Td>
                <Td className="num whitespace-nowrap text-muted">{fmtDateTime(r.logout_at)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"} dot>
                    {r.status || "—"}
                  </Badge>
                </Td>
                <Td className="num font-mono text-xs">{r.ip_address || "—"}</Td>
                <Td className="max-w-[260px]">
                  <span title={r.user_agent || undefined} className="block truncate text-[13px]">
                    {shortUserAgent(r.user_agent)}
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
