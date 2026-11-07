import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export const fmtTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const fmtUsd = (n?: number | null) => `$${(n ?? 0).toFixed(n && n < 0.01 ? 4 : 2)}`;

export const place = (r: { city?: string | null; region?: string | null; country?: string | null }) =>
  [r.city, r.country].filter(Boolean).join(", ") || "—";

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-2xl p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, (value / Math.max(max, 0.0001)) * 100);
  const color = pct > 85 ? "from-rose-500 to-amber-400" : pct > 60 ? "from-amber-400 to-yellow-300" : "from-violet-500 to-cyan-400";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-300">
          {fmtUsd(value)} / {fmtUsd(max)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export function Pager({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (o: number) => void }) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost p-1.5" disabled={page <= 1} onClick={() => onChange(offset - limit)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-mono">
          {page} / {pages}
        </span>
        <button type="button" className="btn-ghost p-1.5" disabled={page >= pages} onClick={() => onChange(offset + limit)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export const providerBadge = (p?: string | null) => {
  const cls: Record<string, string> = {
    openai: "bg-emerald-400/10 text-emerald-300 border-emerald-300/20",
    gemini: "bg-sky-400/10 text-sky-300 border-sky-300/20",
    groq: "bg-orange-400/10 text-orange-300 border-orange-300/20",
    scripted: "bg-slate-400/10 text-slate-300 border-slate-300/20",
  };
  if (!p) return <span className="text-slate-600">—</span>;
  return <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${cls[p] ?? cls.scripted}`}>{p}</span>;
};

export const statusColor = (s: number) =>
  s >= 500 ? "text-rose-400" : s >= 400 ? "text-amber-300" : "text-emerald-300";
