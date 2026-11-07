import { Briefcase, Code2, Github, Globe, Linkedin, Mail, MapPin, Puzzle, Rocket, Sparkles } from "lucide-react";
import type { Content } from "../lib/types";

const TOPICS = [
  { icon: Rocket, label: "Projects", prompt: "What has Bhavya built?" },
  { icon: Briefcase, label: "Experience", prompt: "Walk me through his experience" },
  { icon: Code2, label: "Skills", prompt: "What's his tech stack?" },
  { icon: Puzzle, label: "Riddle game", prompt: "Let's play the riddle game 🧩" },
  { icon: Mail, label: "Contact", prompt: "How do I contact him?" },
];

const LINK_ICON: Record<string, typeof Github> = { GitHub: Github, LinkedIn: Linkedin, Website: Globe };

export default function ProfileRail({
  content,
  onAsk,
  disabled,
}: {
  content: Content | null;
  onAsk: (q: string) => void;
  disabled?: boolean;
}) {
  const c = content?.contact;
  return (
    <div className="flex h-full flex-col gap-5">
      <div className="glass rounded-3xl p-5">
        <div className="relative mx-auto h-24 w-24">
          <div className="absolute inset-0 animate-spinslow rounded-[28px] bg-[conic-gradient(from_0deg,#8B5CF6,#22D3EE,#E879F9,#8B5CF6)] opacity-70 blur-[3px]" />
          <div className="absolute inset-[3px] grid place-items-center rounded-[26px] bg-ink-900 text-3xl font-bold">
            <span className="gradient-text">BJ</span>
          </div>
        </div>
        <h1 className="mt-4 text-center text-xl font-semibold text-white">{c?.name ?? "Bhavya Joshi"}</h1>
        <p className="mt-1 text-center text-sm text-slate-400">{c?.headline ?? "Software Engineer"}</p>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-400/5 px-3 py-2 text-emerald-200/90 ring-1 ring-emerald-300/15">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {c?.current ?? "…"}
          </div>
          <div className="flex items-center gap-2 px-3 text-slate-400">
            <MapPin className="h-4 w-4" /> {c?.location ?? "India"}
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {c?.links.map((l) => {
            const Icon = LINK_ICON[l.label] ?? Globe;
            return (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={l.label}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
          {c && (
            <a
              href={`mailto:${c.email}`}
              aria-label="Email"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <div className="glass rounded-3xl p-4">
        <div className="mb-3 flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-violet-300/80">
          <Sparkles className="h-3 w-3" /> Jump to
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TOPICS.map((t) => (
            <button
              key={t.label}
              type="button"
              disabled={disabled}
              onClick={() => onAsk(t.prompt)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-slate-300 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white disabled:opacity-40 last:col-span-2"
            >
              <t.icon className="h-4 w-4 text-cyan-300" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-auto px-2 text-center text-xs text-slate-600">
        Watson is an AI agent. It knows only what Bhavya taught it, and is occasionally sarcastic.
      </p>
    </div>
  );
}
