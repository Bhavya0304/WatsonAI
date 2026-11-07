import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { Panel } from "./ui";

type LogFile = { name: string; size: number };

export default function Logs() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selected, setSelected] = useState("app.log");
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api<LogFile[]>("/api/admin/logs").then(setFiles);
  }, []);

  const load = useCallback(() => {
    api<{ lines: string[] }>(`/api/admin/logs/${encodeURIComponent(selected)}?lines=1000`)
      .then((r) => setLines(r.lines))
      .catch(() => setLines([]));
  }, [selected]);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    return f ? lines.filter((l) => l.toLowerCase().includes(f)) : lines;
  }, [lines, filter]);

  return (
    <Panel
      title="Log files (rolling, 30-day retention)"
      action={
        <div className="flex flex-wrap gap-2">
          <select className="input w-56" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {files.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} ({(f.size / 1024).toFixed(1)} KB)
              </option>
            ))}
          </select>
          <input className="input w-48" placeholder="Filter text…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button type="button" className="btn-ghost" onClick={load} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="scroll-thin max-h-[70vh] overflow-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
        {shown.length === 0 && <p className="text-slate-500">Nothing here.</p>}
        {shown.map((l, i) => {
          let level = "INFO";
          try {
            level = JSON.parse(l).level ?? "INFO";
          } catch {
            /* plain line */
          }
          return (
            <div key={i} className={`whitespace-pre-wrap break-all ${level === "ERROR" ? "text-rose-300" : level === "WARNING" ? "text-amber-200" : "text-slate-300"}`}>
              {l}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
