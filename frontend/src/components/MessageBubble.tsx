import { motion } from "framer-motion";
import type { ChatMessage, Content } from "../lib/types";
import CardRenderer from "./cards/CardRenderer";
import RiddleCard from "./cards/RiddleCard";
import Markdown from "./Markdown";
import Orb from "./Orb";

export default function MessageBubble({
  message,
  content,
  isLatest,
  onAsk,
}: {
  message: ChatMessage;
  content: Content | null;
  isLatest: boolean;
  onAsk: (q: string) => void;
}) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, x: 10 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-gradient-to-br from-violet-600/90 to-indigo-600/80 px-4 py-2.5 text-[15px] text-white shadow-glow">
          {message.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <div className="pt-1">
        <Orb size={32} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`inline-block max-w-full rounded-2xl rounded-tl-md px-4 py-3 ${
            message.error ? "border border-amber-300/30 bg-amber-400/10 text-amber-100" : "glass text-slate-200"
          }`}
        >
          <Markdown>{message.content}</Markdown>
        </div>
        {message.riddle && (
          <div className="mt-3 grid sm:grid-cols-2">
            <RiddleCard riddle={message.riddle} live={isLatest} onAsk={onAsk} />
          </div>
        )}
        <CardRenderer cards={message.cards} content={content} onAsk={onAsk} />
      </div>
    </motion.div>
  );
}
