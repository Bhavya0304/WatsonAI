import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { MobileRow, Pager, Panel, Table, fmtTime, fmtUsd, providerBadge } from "./ui";

type Row = {
  id: number;
  session_id: string | null;
  ip: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  latency_ms: number | null;
  status: string;
  error: string | null;
  created_at: string;
};
const LIMIT = 50;

export default function LlmCalls() {
  const [provider, setProvider] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; items: Row[] }>({ total: 0, items: [] });

  useEffect(() => {
    const p = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (provider) p.set("provider", provider);
    api<{ total: number; items: Row[] }>(`/api/admin/llm-calls?${p}`).then(setData);
  }, [provider, offset]);

  return (
    <Panel
      title="Model calls"
      action={
        <select
          className="input sm:w-40"
          value={provider}
          onChange={(e) => {
            setOffset(0);
            setProvider(e.target.value);
          }}
        >
          <option value="">All providers</option>
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
          <option value="groq">Groq</option>
        </select>
      }
    >
      <div className="space-y-2 sm:hidden">
        {data.items.map((c) => (
          <MobileRow
            key={c.id}
            top={
              <span className="flex items-center gap-2">
                {providerBadge(c.provider)} <span className="font-mono text-xs text-slate-400">{c.model}</span>
              </span>
            }
            right={<span className={c.status === "ok" ? "text-emerald-300" : "text-rose-300"}>{c.status}</span>}
            lines={[
              fmtTime(c.created_at),
              `${c.prompt_tokens} in / ${c.completion_tokens} out`,
              fmtUsd(c.cost_usd),
              c.latency_ms ? `${c.latency_ms}ms` : null,
              c.error ? <span className="text-rose-300">{c.error.slice(0, 80)}</span> : null,
              c.session_id ? (
                <Link className="font-mono text-cyan-300" to={`/admin/sessions/${c.session_id}`}>
                  session {c.session_id.slice(0, 8)}
                </Link>
              ) : null,
            ].filter(Boolean)}
          />
        ))}
      </div>
      <div className="hidden sm:block">
      <Table head={["Time", "Provider", "Model", "In", "Out", "Cost", "Latency", "Status", "Session"]}>
        {data.items.map((c) => (
          <tr key={c.id} className="text-slate-300">
            <td className="whitespace-nowrap px-3 py-2 text-slate-400">{fmtTime(c.created_at)}</td>
            <td className="px-3 py-2">{providerBadge(c.provider)}</td>
            <td className="px-3 py-2 font-mono text-xs">{c.model}</td>
            <td className="px-3 py-2 font-mono">{c.prompt_tokens}</td>
            <td className="px-3 py-2 font-mono">{c.completion_tokens}</td>
            <td className="px-3 py-2 font-mono">{fmtUsd(c.cost_usd)}</td>
            <td className="px-3 py-2 font-mono text-xs">{c.latency_ms ? `${c.latency_ms}ms` : "—"}</td>
            <td className={`max-w-[220px] truncate px-3 py-2 text-xs ${c.status === "ok" ? "text-emerald-300" : "text-rose-300"}`} title={c.error ?? ""}>
              {c.status}
              {c.error ? `: ${c.error}` : ""}
            </td>
            <td className="px-3 py-2 font-mono text-xs">
              {c.session_id ? (
                <Link className="text-cyan-300 hover:underline" to={`/admin/sessions/${c.session_id}`}>
                  {c.session_id.slice(0, 8)}
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
