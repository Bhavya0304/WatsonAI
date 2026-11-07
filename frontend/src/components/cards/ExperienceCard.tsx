import { Briefcase, MapPin } from "lucide-react";
import type { Experience } from "../../lib/types";
import CardShell, { CardLabel, TechBadges } from "./CardShell";

export default function ExperienceCard({ items, focusId, delay }: { items: Experience[]; focusId: string; delay?: number }) {
  const list = focusId === "all" ? items : items.filter((e) => e.id === focusId);
  const detailed = list.length === 1;

  return (
    <CardShell delay={delay} className="sm:col-span-2">
      <CardLabel>{detailed ? "Experience" : "Career timeline"}</CardLabel>
      <ol className="relative space-y-5 border-l border-white/10 pl-5">
        {list.map((e, i) => (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-[27px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full ring-4 ring-ink-900 ${
                e.end === "Present" ? "bg-gradient-to-br from-violet-400 to-cyan-300" : "bg-slate-500"
              }`}
            >
              {e.end === "Present" && <span className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-cyan-300/50" />}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="font-semibold text-white">
                {e.title} <span className="text-slate-400">@</span> <span className="gradient-text">{e.company}</span>
              </h3>
              <span className="font-mono text-xs text-slate-400">
                {e.start} – {e.end}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {e.location}
              </span>
              {i === 0 && e.end === "Present" && (
                <span className="flex items-center gap-1 text-emerald-300/80">
                  <Briefcase className="h-3 w-3" /> current
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-300">{e.summary}</p>
            {detailed && (
              <>
                <p className="mt-2 text-xs text-slate-500">{e.company_blurb}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {e.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-300" /> {h}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-2">
              <TechBadges items={e.tech} />
            </div>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}
