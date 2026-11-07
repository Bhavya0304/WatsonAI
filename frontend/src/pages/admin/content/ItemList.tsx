import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Master/detail editor for a list of items: pick one on the left, edit it on the right. */
export default function ItemList<T>({
  items,
  onChange,
  label,
  sublabel,
  makeNew,
  renderForm,
  noun,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  label: (item: T) => string;
  sublabel?: (item: T) => string;
  makeNew: () => T;
  renderForm: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  noun: string;
}) {
  const [sel, setSel] = useState(0);
  const current = items[Math.min(sel, items.length - 1)];
  const idx = Math.min(sel, items.length - 1);

  const update = (patch: Partial<T>) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const move = (dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
    setSel(j);
  };
  const remove = () => {
    if (!confirm(`Delete this ${noun}? (It's only gone once you press Save.)`)) return;
    onChange(items.filter((_, i) => i !== idx));
    setSel(Math.max(0, idx - 1));
  };
  const add = () => {
    onChange([...items, makeNew()]);
    setSel(items.length);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSel(i)}
            className={`w-full rounded-xl border px-3 py-2 text-left transition ${
              i === idx ? "border-violet-400/40 bg-violet-500/10" : "border-white/5 bg-white/[0.02] hover:border-white/15"
            }`}
          >
            <div className="truncate text-sm text-white">{label(it) || <span className="text-slate-500">Untitled {noun}</span>}</div>
            {sublabel && <div className="truncate text-[11px] text-slate-500">{sublabel(it)}</div>}
          </button>
        ))}
        <button type="button" onClick={add} className="btn-ghost w-full justify-center py-2 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add {noun}
        </button>
      </div>

      {current ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-4 flex items-center justify-end gap-1">
            <button type="button" className="btn-ghost p-1.5" onClick={() => move(-1)} disabled={idx === 0} aria-label="Move up">
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" className="btn-ghost p-1.5" onClick={() => move(1)} disabled={idx === items.length - 1} aria-label="Move down">
              <ArrowDown className="h-4 w-4" />
            </button>
            <button type="button" className="btn-ghost p-1.5 text-rose-300 hover:text-rose-200" onClick={remove} aria-label={`Delete ${noun}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {/* key forces line/tag inputs to reset when switching items */}
          <div key={idx} className="space-y-4">
            {renderForm(current, update)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No {noun}s yet.</p>
      )}
    </div>
  );
}
