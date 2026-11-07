import { X } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  ...rest
}: { value: string | number | null | undefined; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  mono,
  ...rest
}: { value: string; onChange: (v: string) => void; rows?: number; mono?: boolean } & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
>) {
  return (
    <textarea
      className={`input resize-y leading-relaxed ${mono ? "font-mono text-xs" : ""}`}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

/** One item per line, e.g. highlights. */
export function LinesInput({ value, onChange, rows = 4, placeholder }: { value: string[]; onChange: (v: string[]) => void; rows?: number; placeholder?: string }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <TextArea
      rows={rows}
      value={text}
      placeholder={placeholder}
      onChange={(t) => {
        setText(t);
        onChange(t.split("\n").map((s) => s.trim()).filter(Boolean));
      }}
    />
  );
}

/** Chip input: Enter or comma adds, × removes. */
export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2 focus-within:border-violet-500/60">
      {value.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] text-cyan-100">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-cyan-200/60 hover:text-white">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        value={draft}
        placeholder={placeholder ?? "Type and press Enter"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-3 text-left">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-gradient-to-r from-violet-500 to-cyan-400" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span className="text-sm text-slate-200">{label}</span>
    </button>
  );
}

export function Notice({ kind, children }: { kind: "ok" | "error" | "info"; children: ReactNode }) {
  const cls = {
    ok: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
    error: "border-rose-300/30 bg-rose-400/10 text-rose-100",
    info: "border-cyan-300/20 bg-cyan-400/5 text-cyan-100",
  }[kind];
  return <div className={`rounded-xl border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}
