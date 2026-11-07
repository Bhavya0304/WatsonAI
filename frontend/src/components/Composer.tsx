import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Composer({
  onSend,
  disabled,
  maxChars = 800,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  maxChars?: number;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    if (!disabled) ref.current?.focus({ preventScroll: true });
  }, [disabled]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  const over = value.length > maxChars;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="glass-strong flex items-end gap-2 rounded-2xl p-2 shadow-glow transition focus-within:border-violet-400/40"
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ask Watson anything about Bhavya…"
        aria-label="Message Watson"
        className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-slate-100 outline-none placeholder:text-slate-500"
      />
      {value.length > maxChars * 0.8 && (
        <span className={`self-center font-mono text-xs ${over ? "text-rose-400" : "text-slate-500"}`}>
          {value.length}/{maxChars}
        </span>
      )}
      <button
        type="submit"
        disabled={disabled || !value.trim() || over}
        aria-label="Send"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white transition hover:scale-105 disabled:scale-100 disabled:opacity-30"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </form>
  );
}
