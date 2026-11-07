import { motion } from "framer-motion";

/** Watson's avatar: a glowing gradient orb with a slow-spinning conic ring. Pulses while thinking. */
export default function Orb({ size = 40, thinking = false }: { size?: number; thinking?: boolean }) {
  return (
    <motion.div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      animate={thinking ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={thinking ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
      aria-hidden
    >
      <div
        className="absolute inset-0 animate-spinslow rounded-full opacity-80 blur-[2px]"
        style={{
          background: "conic-gradient(from 0deg, #8B5CF6, #22D3EE, #E879F9, #8B5CF6)",
        }}
      />
      <div
        className="absolute inset-[2px] rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 30%, #A5F3FC 0%, #8B5CF6 45%, #1B2547 100%)",
        }}
      />
      <div className="absolute inset-[22%] rounded-full bg-white/25 blur-md" />
      {thinking && <div className="absolute -inset-2 rounded-full bg-violet-500/30 blur-xl" />}
    </motion.div>
  );
}
