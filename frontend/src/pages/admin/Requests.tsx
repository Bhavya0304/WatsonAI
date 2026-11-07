import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { MobileRow, Pager, Panel, Table, fmtTime, statusColor } from "./ui";

type Row = { id: number; ts: string; ip: string; method: string; path: string; status: number; latency_ms: number; session_id: string | null };
const LIMIT = 50;

export default function Requests() {
  const [filters, setFilters] = useState({ ip: "", path: "", status: "" });
  const [applied, setApplied] = useState(filters);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; items: Row[] }>({ total: 0, items: [] });

  useEffect(() => {
    const p = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    Object.entries(applied).forEach(([k, v]) => v && p.set(k, v));
    api<{ total: number; items: Row[] }>(`/api/admin/requests?${p}`).then(setData);
  }, [applied, offset]);

  return (
    <Panel
      title="Requests (last 30 days)"
      action={
        <form
          className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setApplied(filters);
          }}
        >
          <input className="input sm:w-36" placeholder="IP" value={filters.ip} onChange={(e) => setFilters({ ...filters, ip: e.target.value })} />
          <input className="input sm:w-36" placeholder="Path" value={filters.path} onChange={(e) => setFilters({ ...filters, path: e.target.value })} />
          <input className="input sm:w-24" placeholder="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value.replace(/\D/g, "") })} />
          <button className="btn-ghost justify-center" type="submit">
            Filter
          </button>
        </form>
      }
    >
      <div className="space-y-2 sm:hidden">
        {data.items.map((r) => (
          <MobileRow
            key={r.id}
            top={
              <span className="font-mono text-xs">
                <span className="text-slate-400">{r.method}</span> {r.path}
              </span>
            }
            right={<span className={`font-mono ${statusColor(r.status)}`}>{r.status}</span>}
            lines={[
              fmtTime(r.ts),
              <span className="font-mono">{r.ip}</span>,
              `${r.latency_ms}ms`,
              r.session_id ? (
                <Link className="font-mono text-cyan-300" to={`/admin/sessions/${r.session_id}`}>
                  session {r.session_id.slice(0, 8)}
                </Link>
              ) : null,
            ].filter(Boolean)}
          />
        ))}
      </div>
      <div className="hidden sm:block">
      <Table head={["Time", "IP", "Method", "Path", "Status", "Latency", "Session"]}>
        {data.items.map((r) => (
          <tr key={r.id} className="text-slate-300">
            <td className="whitespace-nowrap px-3 py-2 text-slate-400">{fmtTime(r.ts)}</td>
            <td className="px-3 py-2 font-mono text-xs">{r.ip}</td>
            <td className="px-3 py-2 font-mono text-xs">{r.method}</td>
            <td className="px-3 py-2 font-mono text-xs">{r.path}</td>
            <td className={`px-3 py-2 font-mono ${statusColor(r.status)}`}>{r.status}</td>
            <td className="px-3 py-2 font-mono text-xs">{r.latency_ms}ms</td>
            <td className="px-3 py-2 font-mono text-xs">
              {r.session_id ? (
                <Link className="text-cyan-300 hover:underline" to={`/admin/sessions/${r.session_id}`}>
                  {r.session_id.slice(0, 8)}
                </Link>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </Table>
      </div>
      <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
    </Panel>
  );
}
