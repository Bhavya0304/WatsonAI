import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function SuggestionChips({
  items,
  onPick,
  disabled,
}: {
  items: string[];
  onPick: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <AnimatePresence mode="popLayout">
        {items.map((s, i) => (
          <motion.button
            key={s}
            type="button"
            layout
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: i * 0.05 }}
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group flex shrink-0 items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-3.5 py-1.5 text-sm text-violet-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/10 hover:text-white disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-300 transition group-hover:text-cyan-300" />
            {s}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
