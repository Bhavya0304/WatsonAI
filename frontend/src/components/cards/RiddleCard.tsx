import { motion } from "framer-motion";
import { Flag, Flame, Lightbulb, Puzzle, SkipForward, Trophy } from "lucide-react";
import { useState } from "react";
import type { RiddleState } from "../../lib/types";
import CardShell from "./CardShell";

const STATUS = {
  active: { label: "Your move", cls: "bg-violet-400/15 text-violet-200 border-violet-300/20" },
  wrong: { label: "Nope, try again", cls: "bg-amber-400/15 text-amber-200 border-amber-300/20" },
  solved: { label: "Solved!", cls: "bg-emerald-400/15 text-emerald-200 border-emerald-300/20" },
  revealed: { label: "Revealed", cls: "bg-slate-400/15 text-slate-300 border-slate-300/20" },
} as const;

const LEVEL = {
  easy: { dots: 1, cls: "text-emerald-300", ring: "border-emerald-400/20" },
  medium: { dots: 2, cls: "text-amber-300", ring: "border-amber-400/25" },
  hard: { dots: 3, cls: "text-rose-300", ring: "border-rose-400/30" },
} as const;

export default function RiddleCard({ riddle, live, onAsk }: { riddle: RiddleState; live: boolean; onAsk?: (q: string) => void }) {
  const [showHint, setShowHint] = useState(false);
  const st = STATUS[riddle.status];
  const lv = LEVEL[riddle.difficulty] ?? LEVEL.medium;
  const open = riddle.status === "active" || riddle.status === "wrong";

  return (
    <CardShell className={`sm:col-span-2 ${lv.ring}`}>
      {riddle.status === "solved" && <Confetti />}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${lv.cls}`}>
            {riddle.level_name} · #{riddle.asked}
          </span>
          <span className="flex gap-0.5" aria-label={`Difficulty ${riddle.difficulty}`}>
            {[1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= lv.dots ? lv.cls.replace("text-", "bg-") : "bg-white/10"}`} />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-2.5 font-mono text-[11px]">
          {riddle.streak > 0 && (
            <motion.span key={riddle.streak} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="flex items-center gap-0.5 text-orange-300">
              <Flame className="h-3.5 w-3.5" /> {riddle.streak}
            </motion.span>
          )}
          <span className="flex items-center gap-1 text-slate-400" title={`Best streak: ${riddle.best_streak}`}>
            <Trophy className="h-3.5 w-3.5 text-amber-300" /> {riddle.score}/{riddle.asked}
          </span>
          <span className={`rounded-full border px-2 py-0.5 font-sans text-[10px] font-medium ${st.cls}`}>{st.label}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Puzzle className="mt-0.5 h-6 w-6 shrink-0 text-violet-300" />
        <p className="text-base font-medium leading-relaxed text-white">{riddle.question}</p>
      </div>

      {open && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[10px] text-slate-500">guesses</span>
          <div className="flex flex-1 gap-1">
            {Array.from({ length: riddle.max_attempts }).map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < riddle.attempts ? "bg-rose-400/70" : "bg-white/10"}`} />
            ))}
          </div>
        </div>
      )}

      {riddle.answer && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mt-3 rounded-xl border p-3 text-sm ${
            riddle.status === "solved" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-200"
          }`}
        >
          {riddle.status === "solved" ? "🎉 " : "💡 "}Answer: <strong>{riddle.answer}</strong>
          {riddle.status === "solved" && riddle.streak >= 2 && <span className="ml-2 text-orange-200">🔥 {riddle.streak} in a row!</span>}
        </motion.div>
      )}

      {open && showHint && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm italic text-cyan-200/90">
          🤫 {riddle.hint}
        </motion.p>
      )}

      {live && (
        <div className="mt-4 flex flex-wrap gap-2">
          {open ? (
            <>
              {!showHint && (
                <button type="button" onClick={() => setShowHint(true)} className="btn-ghost py-1.5 text-xs">
                  <Lightbulb className="h-3.5 w-3.5" /> Hint
                </button>
              )}
              <button type="button" onClick={() => onAsk?.("I give up, what's the answer?")} className="btn-ghost py-1.5 text-xs">
                <Flag className="h-3.5 w-3.5" /> I give up
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onAsk?.("Next riddle 🧩")} className="btn-primary py-1.5 text-xs">
                <SkipForward className="h-3.5 w-3.5" /> Next riddle
              </button>
              {riddle.difficulty !== "hard" && (
                <button type="button" onClick={() => onAsk?.("Give me a hard riddle 😈")} className="btn-ghost py-1.5 text-xs">
                  😈 Boss round
                </button>
              )}
            </>
          )}
        </div>
      )}
    </CardShell>
  );
}

function Confetti() {
  const bits = Array.from({ length: 18 });
  const colors = ["#A78BFA", "#22D3EE", "#F0ABFC", "#FCD34D", "#6EE7B7"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((_, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-2 w-1.5 rounded-sm"
          style={{ left: `${(i / bits.length) * 100}%`, background: colors[i % colors.length] }}
          initial={{ y: -10, opacity: 1, rotate: 0 }}
          animate={{ y: 220, opacity: 0, rotate: 360 + i * 20 }}
          transition={{ duration: 1.4 + (i % 4) * 0.2, ease: "easeOut", delay: (i % 5) * 0.05 }}
        />
      ))}
    </div>
  );
}
