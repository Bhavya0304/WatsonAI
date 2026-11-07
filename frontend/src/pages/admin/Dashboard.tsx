import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Meter, Panel, Stat, Table, fmtTime, fmtUsd, providerBadge } from "./ui";

type Window = { sessions: number; visits: number; unique_ips: number; messages: number };
type Stats = {
  "7d": Window;
  "30d": Window;
  providers: { provider: string; calls: number; ok: number; errors: number; prompt_tokens: number; completion_tokens: number; cost_usd: number }[];
  daily: { day: string; visits: number; sessions: number; messages: number }[];
  countries: { country: string; sessions: number }[];
  budget: {
    configured: boolean;
    disabled_reason: string | null;
    lifetime_spend: number;
    lifetime_cap: number;
    month_spend: number;
    month_cap: number;
    remaining: number;
  };
  provider_states: { name: string; model: string; configured: boolean; cooldown_until: string | null }[];
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(() => api<Stats>("/api/admin/stats").then(setStats), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const reset = async () => {
    if (!confirm("Re-enable OpenAI and restart the lifetime spend counter from $0? Do this after topping up your OpenAI credit.")) return;
    setResetting(true);
    await api("/api/admin/openai/reset", { method: "POST" }).finally(() => setResetting(false));
    load();
  };

  if (!stats) return <p className="text-slate-500">Loading…</p>;
  const b = stats.budget;
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.visits));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Conversations · 7d" value={stats["7d"].sessions} sub={`${stats["30d"].sessions} in 30d`} />
        <Stat label="Visitor messages · 7d" value={stats["7d"].messages} sub={`${stats["30d"].messages} in 30d`} />
        <Stat label="Unique IPs · 30d" value={stats["30d"].unique_ips} sub={`${stats["30d"].visits} page visits`} />
        <Stat label="OpenAI remaining" value={fmtUsd(b.remaining)} sub={b.disabled_reason ? `disabled: ${b.disabled_reason}` : "of lifetime cap"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="OpenAI budget"
          className="lg:col-span-1"
          action={
            <button type="button" onClick={reset} disabled={resetting} className="btn-ghost py-1 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          }
        >
          <div className="space-y-4">
            <Meter label="Lifetime (since last reset)" value={b.lifetime_spend} max={b.lifetime_cap} />
            <Meter label="This month" value={b.month_spend} max={b.month_cap} />
          </div>
          <div className="mt-5 space-y-2">
            {stats.provider_states.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {providerBadge(p.name)}
                  <span className="font-mono text-xs text-slate-400">{p.model}</span>
                </div>
                <span className={`text-xs ${!p.configured ? "text-slate-600" : p.cooldown_until ? "text-amber-300" : "text-emerald-300"}`}>
                  {!p.configured ? "no key" : p.cooldown_until ? `cooldown → ${fmtTime(p.cooldown_until)}` : "ready"}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Visits · last 30 days" className="lg:col-span-2">
          {stats.daily.length === 0 ? (
            <p className="text-sm text-slate-500">No visits yet. Share that link! 🚀</p>
          ) : (
            <div className="flex h-44 items-end gap-1">
              {stats.daily.map((d) => (
                <div key={d.day} className="group relative flex flex-1 flex-col justify-end" title={`${d.day}: ${d.visits} visits, ${d.sessions} chats, ${d.messages} messages`}>
                  <div
                    className="rounded-t bg-gradient-to-t from-violet-600/70 to-cyan-400/70 transition group-hover:from-violet-500 group-hover:to-cyan-300"
                    style={{ height: `${(d.visits / maxDaily) * 100}%`, minHeight: 4 }}
                  />
                  <span className="mt-1 hidden text-center font-mono text-[9px] text-slate-600 sm:block">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Model usage · 30d" className="lg:col-span-2">
          <Table head={["Provider", "Calls", "OK", "Errors", "Tokens in", "Tokens out", "Cost"]}>
            {stats.providers.map((p) => (
              <tr key={p.provider} className="text-slate-300">
                <td className="px-3 py-2">{providerBadge(p.provider)}</td>
                <td className="px-3 py-2 font-mono">{p.calls}</td>
                <td className="px-3 py-2 font-mono text-emerald-300">{p.ok}</td>
                <td className="px-3 py-2 font-mono text-rose-300">{p.errors}</td>
                <td className="px-3 py-2 font-mono">{(p.prompt_tokens ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono">{(p.completion_tokens ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono">{fmtUsd(p.cost_usd)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Top countries · 30d">
          <ul className="space-y-2 text-sm">
            {stats.countries.map((c) => (
              <li key={c.country} className="flex justify-between text-slate-300">
                <span>{c.country}</span>
                <span className="font-mono text-slate-400">{c.sessions}</span>
              </li>
            ))}
            {stats.countries.length === 0 && <li className="text-slate-500">Nobody yet.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
