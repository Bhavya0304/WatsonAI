import { ChevronDown, ExternalLink, MessageCircle } from "lucide-react";
import { useState } from "react";
import type { Project } from "../../lib/types";
import CardShell, { CardLabel, TechBadges } from "./CardShell";

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-400/15 text-emerald-300 border-emerald-300/20",
  Live: "bg-emerald-400/15 text-emerald-300 border-emerald-300/20",
  "In production": "bg-sky-400/15 text-sky-300 border-sky-300/20",
  Research: "bg-fuchsia-400/15 text-fuchsia-300 border-fuchsia-300/20",
};

export default function ProjectCard({
  project,
  onAsk,
  delay,
}: {
  project: Project;
  onAsk?: (q: string) => void;
  delay?: number;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? project.highlights : project.highlights.slice(0, 3);

  return (
    <CardShell delay={delay} className="flex flex-col">
      <CardLabel>Project</CardLabel>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-400/20 text-2xl ring-1 ring-white/10">
          {project.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{project.title}</h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                STATUS_STYLE[project.status] ?? "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {project.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-400">{project.tagline}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
        {shown.map((h) => (
          <li key={h} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
            {h}
          </li>
        ))}
      </ul>
      {project.highlights.length > 3 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
          {open ? "less" : `${project.highlights.length - 3} more`}
        </button>
      )}

      <div className="mt-3">
        <TechBadges items={project.tech} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {onAsk && (
          <button type="button" onClick={() => onAsk(`Tell me more about ${project.title}`)} className="btn-ghost py-1.5 text-xs">
            <MessageCircle className="h-3.5 w-3.5" /> Ask about it
          </button>
        )}
        {project.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="btn-ghost py-1.5 text-xs">
            <ExternalLink className="h-3.5 w-3.5" /> {l.label}
          </a>
        ))}
      </div>
    </CardShell>
  );
}
