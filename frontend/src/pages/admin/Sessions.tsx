import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { MobileRow, Pager, Panel, Table, fmtTime, fmtUsd, place, providerBadge } from "./ui";

type Row = {
  id: string;
  ip: string;
  city: string | null;
  region: string | null;
  country: string | null;
  visitor_name: string | null;
  visitor_relation: string | null;
  visitor_company: string | null;
  visitor_declined: number;
  started_at: string;
  last_active_at: string;
  ended_at: string | null;
  emailed_at: string | null;
  email_status: string | null;
  user_message_count: number;
  cost_usd: number;
  last_provider: string | null;
};

const LIMIT = 25;

const emailState = (r: Row) =>
  "ended" +
  (r.email_status === "sent" ? " · ✉️" : r.email_status?.startsWith("failed") ? " · ⚠️ email failed" : r.email_status?.startsWith("skipped") ? " · email off" : "");

export default function Sessions() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [data, setData] = useState<{ total: number; items: Row[] }>({ total: 0, items: [] });

  useEffect(() => {
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset), include_empty: String(includeEmpty) });
    if (query) params.set("q", query);
    api<{ total: number; items: Row[] }>(`/api/admin/sessions?${params}`).then(setData);
  }, [query, offset, includeEmpty]);

  return (
    <Panel
      title="Sessions"
      action={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" checked={includeEmpty} onChange={(e) => { setOffset(0); setIncludeEmpty(e.target.checked); }} />
            include silent visits
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setOffset(0);
              setQuery(q.trim());
            }}
            className="relative w-full sm:w-auto"
          >
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input className="input w-full pl-8 sm:w-56" placeholder="IP, name, company, country…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        </div>
      }
    >
      <div className="space-y-2 sm:hidden">
        {data.items.map((r) => (
          <MobileRow
            key={r.id}
            onClick={() => navigate(`/admin/sessions/${r.id}`)}
            top={
              <>
                <span className="font-medium">{r.visitor_name ?? (r.visitor_declined ? "🕶️ private" : "Anonymous")}</span>
                {(r.visitor_relation || r.visitor_company) && (
                  <span className="ml-1.5 text-xs text-slate-500">{[r.visitor_relation, r.visitor_company].filter(Boolean).join(" · ")}</span>
                )}
              </>
            }
            right={r.ended_at ? <span className="text-slate-500">{emailState(r)}</span> : <span className="text-emerald-300">● live</span>}
            lines={[fmtTime(r.started_at), place(r), <span className="font-mono">{r.ip}</span>, `${r.user_message_count} msgs`, fmtUsd(r.cost_usd), providerBadge(r.last_provider)]}
          />
        ))}
      </div>
      <div className="hidden sm:block">
      <Table head={["Started", "Visitor", "IP", "Location", "Msgs", "Model", "Cost", "State"]}>
        {data.items.map((r) => (
          <tr key={r.id} onClick={() => navigate(`/admin/sessions/${r.id}`)} className="cursor-pointer text-slate-300 transition hover:bg-white/[0.04]">
            <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">{fmtTime(r.started_at)}</td>
            <td className="px-3 py-2.5">
              <div className="text-white">{r.visitor_name ?? (r.visitor_declined ? "🕶️ private" : "Anonymous")}</div>
              <div className="text-xs text-slate-500">{[r.visitor_relation, r.visitor_company].filter(Boolean).join(" · ")}</div>
            </td>
            <td className="px-3 py-2.5 font-mono text-xs">{r.ip}</td>
            <td className="px-3 py-2.5">{place(r)}</td>
            <td className="px-3 py-2.5 font-mono">{r.user_message_count}</td>
            <td className="px-3 py-2.5">{providerBadge(r.last_provider)}</td>
            <td className="px-3 py-2.5 font-mono text-xs">{fmtUsd(r.cost_usd)}</td>
            <td className="px-3 py-2.5 text-xs">
              {r.ended_at ? (
                <span className="text-slate-500" title={r.email_status ?? ""}>
                  {emailState(r)}
                </span>
              ) : (
                <span className="text-emerald-300">● live</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
      </div>
      {data.items.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No sessions found.</p>}
      <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
    </Panel>
  );
}
