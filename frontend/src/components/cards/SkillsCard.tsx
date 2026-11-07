import { Brain, Cloud, Server, Layers } from "lucide-react";
import type { Content } from "../../lib/types";
import CardShell, { CardLabel } from "./CardShell";

const ICONS = [Layers, Server, Brain, Cloud];

export default function SkillsCard({ groups, delay }: { groups: Content["skills"]; delay?: number }) {
  return (
    <CardShell delay={delay} className="sm:col-span-2">
      <CardLabel>Skill tree</CardLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <div key={g.title}>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                <Icon className="h-4 w-4 text-cyan-300" /> {g.title}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}
