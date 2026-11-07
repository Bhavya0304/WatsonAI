import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Background from "../components/Background";
import Composer from "../components/Composer";
import MessageBubble from "../components/MessageBubble";
import Orb from "../components/Orb";
import ProfileRail from "../components/ProfileRail";
import SuggestionChips from "../components/SuggestionChips";
import TypingIndicator from "../components/TypingIndicator";
import { api, ApiError, beacon, setSessionHeader } from "../lib/api";
import type { ChatMessage, ChatResponse, Content, SessionStart } from "../lib/types";

const SESSION_KEY = "watson_session";
const NUDGE_AFTER_MS = 40_000;
const NUDGES = [
  "Still there? 👀 No pressure. I can show you his coolest project, or you can try my riddle game. Fair warning: it has humbled engineers 🧩",
  "I promise I'm more fun than I look 😄 Ask me anything about Bhavya, or challenge me to a riddle. Your call.",
  "The silence is deafening 🦗 Here's a deal: solve one riddle and I'll tell you Bhavya's coolest project. Or skip straight to the project. I'm easy.",
];

let counter = 0;
const uid = () => `m${Date.now()}-${counter++}`;

export default function Chat() {
  const [content, setContent] = useState<Content | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const sessionId = useRef<string | null>(null);
  const started = useRef(false);
  const nudged = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const push = useCallback((m: Omit<ChatMessage, "id">) => setMessages((prev) => [...prev, { ...m, id: uid() }]), []);

  const startSession = useCallback(
    async (existing: string | null, silent = false) => {
      const res = await api<SessionStart>("/api/session/start", { json: { session_id: existing } });
      sessionId.current = res.session_id;
      setSessionHeader(res.session_id);
      try {
        sessionStorage.setItem(SESSION_KEY, res.session_id);
      } catch {
        /* storage blocked: session just won't survive a reload */
      }
      if (silent) return;
      const msgs: ChatMessage[] = res.messages.map((m) => ({ ...m, id: uid(), riddle: null }));
      if (!res.resumed) await new Promise((r) => setTimeout(r, 900)); // let the orb "think" for a beat
      setMessages(msgs);
    },
    [],
  );

  // Boot: load card content + start/resume the session (guarded against StrictMode double-run).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<Content>("/api/content").then(setContent).catch(() => setContent(null));
    let existing: string | null = null;
    try {
      existing = sessionStorage.getItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    startSession(existing)
      .catch(() =>
        push({
          role: "assistant",
          content: "Hmm, I can't reach my brain right now 🔌 Give it a moment and refresh the page.",
          cards: [],
          suggestions: [],
          error: true,
        }),
      )
      .finally(() => setBusy(false));
  }, [push, startSession]);

  // Tell the backend when the tab goes away (it waits a grace period in case this is just a reload).
  useEffect(() => {
    const onHide = () => sessionId.current && beacon("/api/session/end", { session_id: sessionId.current });
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // Proactive nudge if the visitor hasn't said anything yet.
  useEffect(() => {
    if (nudged.current || messages.length === 0 || messages.some((m) => m.role === "user")) return;
    const t = setTimeout(() => {
      nudged.current = true;
      push({
        role: "assistant",
        content: NUDGES[Math.floor(Math.random() * NUDGES.length)],
        cards: [],
        suggestions: ["Show me his best project 🚀", "Play the riddle game 🧩", "Who is Bhavya, quickly?"],
      });
    }, NUDGE_AFTER_MS);
    return () => clearTimeout(t);
  }, [messages, push]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      if (busy || !text.trim()) return;
      setProfileOpen(false);
      push({ role: "user", content: text, cards: [], suggestions: [] });
      setBusy(true);

      const ask = () => api<ChatResponse>("/api/chat", { json: { session_id: sessionId.current, message: text } });
      try {
        let res: ChatResponse;
        try {
          res = await ask();
        } catch (err) {
          // Session expired (idle) or vanished: quietly start a fresh one and retry once.
          if (err instanceof ApiError && (err.status === 410 || err.status === 404)) {
            await startSession(null, true);
            res = await ask();
          } else throw err;
        }
        push({ role: "assistant", content: res.reply, cards: res.cards, suggestions: res.suggestions, riddle: res.riddle });
      } catch (err) {
        const friendly =
          err instanceof ApiError && (err.status === 429 || err.status === 422)
            ? err.message
            : "Watson appears to have wandered off 🫠 Try again in a moment.";
        push({ role: "assistant", content: friendly, cards: [], suggestions: ["Try again"], error: true });
      } finally {
        setBusy(false);
      }
    },
    [busy, push, startSession],
  );

  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);
  const lastIndex = messages.length - 1;
  const lastUserText = useMemo(() => [...messages].reverse().find((m) => m.role === "user")?.content, [messages]);

  const pick = (s: string) => (s === "Try again" && lastUserText ? send(lastUserText) : send(s));

  return (
    <div className="relative flex h-[100dvh] overflow-hidden">
      <Background />

      <aside className="scroll-thin hidden w-[330px] shrink-0 overflow-y-auto p-5 lg:block">
        <ProfileRail content={content} onAsk={send} disabled={busy} />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3 backdrop-blur-md sm:px-6">
          <Orb size={38} thinking={busy} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-white">Watson</span>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200">
                AI agent
              </span>
            </div>
            <p className="truncate text-xs text-slate-400">
              {busy ? "thinking…" : "Bhavya Joshi's portfolio, but it talks back"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-sm font-bold lg:hidden"
            aria-label="About Bhavya"
          >
            <span className="gradient-text">BJ</span>
          </button>
        </header>

        <div className="scroll-thin flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            {messages.length === 0 && busy && (
              <div className="flex flex-col items-center gap-4 pt-24 text-center">
                <Orb size={88} thinking />
                <p className="gradient-text text-lg font-medium">Waking up Watson…</p>
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={m.id} message={m} content={content} isLatest={i === lastIndex} onAsk={send} />
            ))}
            <AnimatePresence>{busy && messages.length > 0 && <TypingIndicator />}</AnimatePresence>
            <div ref={endRef} className="h-1" />
          </div>
        </div>

        <footer className="mx-auto w-full max-w-3xl space-y-3 px-4 pb-4 pt-2 sm:px-6">
          {!busy && lastAssistant && lastAssistant.suggestions.length > 0 && (
            <SuggestionChips items={lastAssistant.suggestions} onPick={pick} disabled={busy} />
          )}
          <Composer onSend={send} disabled={busy} />
          <p className="text-center text-[11px] text-slate-600">
            Conversations are logged so Bhavya can read them. Don't share anything you wouldn't put in an email.
          </p>
        </footer>
      </main>

      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm lg:hidden"
            onClick={() => setProfileOpen(false)}
          >
            <motion.div
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              className="scroll-thin max-h-full overflow-y-auto p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={() => setProfileOpen(false)} className="btn-ghost p-2" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ProfileRail content={content} onAsk={send} disabled={busy} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
