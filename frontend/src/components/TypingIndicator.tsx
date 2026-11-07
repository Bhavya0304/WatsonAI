import { motion } from "framer-motion";
import Orb from "./Orb";

const LINES = ["thinking", "digging through Bhavya's repos", "consulting the vector DB", "choosing words carefully"];

export default function TypingIndicator() {
  const line = LINES[Math.floor(Date.now() / 4000) % LINES.length];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3"
    >
      <Orb size={32} thinking />
      <div className="glass flex items-center gap-3 rounded-2xl rounded-tl-md px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        <span className="font-mono text-xs text-slate-400">{line}…</span>
      </div>
    </motion.div>
  );
}
