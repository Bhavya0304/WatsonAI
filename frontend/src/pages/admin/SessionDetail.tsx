import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Markdown from "../../components/Markdown";
import { api } from "../../lib/api";
import { Panel, Table, fmtTime, fmtUsd, place, providerBadge } from "./ui";

type Detail = {
  session: Record<string, string | number | null>;
  messages: { id: number; role: string; content: string; cards: { type: string; id: string }[]; provider: string | null; created_at: string }[];
  llm_calls: { id: number; provider: string; model: string; prompt_tokens: number; completion_tokens: number; cost_usd: number; latency_ms: number | null; status: string; error: string | null; created_at: string }[];
};

export default function SessionDetail() {
  const { id } = useParams();
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    api<Detail>(`/api/admin/sessions/${id}`).then(setD);
  }, [id]);

  if (!d) return <p className="text-slate-500">Loading…</p>;
  const s = d.session;
  const info: [string, React.ReactNode][] = [
    ["Visitor", (s.visitor_name as string) ?? "Anonymous"],
    ["Relation", s.visitor_relation ?? "—"],
    ["Company / role", s.visitor_company ?? "—"],
    ["Email", s.visitor_email ?? "—"],
    ["Prefers privacy", s.visitor_declined ? "yes" : "no"],
    ["IP", <span className="font-mono">{s.ip}</span>],
    ["Location", place(s as never)],
    ["Device", <span className="break-all text-xs">{s.user_agent}</span>],
    ["Started", fmtTime(s.started_at as string)],
    ["Last active", fmtTime(s.last_active_at as string)],
    ["Ended", fmtTime(s.ended_at as string)],
    ["Emailed", fmtTime(s.emailed_at as string)],
    ["OpenAI cost", fmtUsd(s.cost_usd as number)],
  ];

  return (
    <div className="space-y-6">
      <Link to="/admin/sessions" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All sessions
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Visitor" className="h-fit">
          <dl className="space-y-2 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="min-w-0 text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title={`Transcript · ${d.messages.length} messages`} className="lg:col-span-2">
          <div className="space-y-3">
            {d.messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-violet-600/80 text-white" : "glass"}`}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <Markdown>{m.content}</Markdown>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                    <span>{fmtTime(m.created_at)}</span>
                    {m.provider && providerBadge(m.provider)}
                    {m.cards.map((c) => (
                      <span key={`${c.type}:${c.id}`} className="chip py-0 text-[10px]">
                        {c.type}:{c.id}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Model calls">
        <Table head={["Time", "Provider", "Model", "In", "Out", "Cost", "Latency", "Status"]}>
          {d.llm_calls.map((c) => (
            <tr key={c.id} className="text-slate-300">
              <td className="whitespace-nowrap px-3 py-2 text-slate-400">{fmtTime(c.created_at)}</td>
              <td className="px-3 py-2">{providerBadge(c.provider)}</td>
              <td className="px-3 py-2 font-mono text-xs">{c.model}</td>
              <td className="px-3 py-2 font-mono">{c.prompt_tokens}</td>
              <td className="px-3 py-2 font-mono">{c.completion_tokens}</td>
              <td className="px-3 py-2 font-mono">{fmtUsd(c.cost_usd)}</td>
              <td className="px-3 py-2 font-mono">{c.latency_ms ? `${c.latency_ms}ms` : "—"}</td>
              <td className={`px-3 py-2 text-xs ${c.status === "ok" ? "text-emerald-300" : "text-rose-300"}`} title={c.error ?? ""}>
                {c.status}
                {c.error ? `: ${c.error.split(":")[0]}` : ""}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
