import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function CardShell({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 backdrop-blur-xl transition hover:border-violet-400/30 ${className}`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl transition group-hover:bg-cyan-400/15" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

export function TechBadges({ items, max = 8 }: { items: string[]; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.slice(0, max).map((t) => (
        <span key={t} className="rounded-md border border-cyan-300/15 bg-cyan-400/5 px-2 py-0.5 font-mono text-[11px] text-cyan-200/90">
          {t}
        </span>
      ))}
      {items.length > max && <span className="px-1 font-mono text-[11px] text-slate-500">+{items.length - max}</span>}
    </div>
  );
}

export function CardLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-violet-300/80">{children}</div>;
}
