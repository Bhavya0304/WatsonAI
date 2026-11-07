import { GraduationCap, Lightbulb, Sparkles } from "lucide-react";
import type { Content } from "../../lib/types";
import CardShell, { CardLabel } from "./CardShell";

export default function ProfileCard({ content, delay }: { content: Content; delay?: number }) {
  const { contact, profile } = content;
  return (
    <CardShell delay={delay} className="sm:col-span-2">
      <CardLabel>Profile</CardLabel>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg font-bold text-white">
          BJ
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{contact.name}</h3>
          <p className="text-sm text-slate-400">{contact.headline}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-300">{profile.about}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Fact icon={GraduationCap} title="Education" text={profile.education} />
        <Fact icon={Lightbulb} title="Philosophy" text={profile.philosophy.split(". ")[0] + "."} />
        <Fact icon={Sparkles} title="Into lately" text={profile.interests} />
      </div>
    </CardShell>
  );
}

function Fact({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-cyan-200">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <p className="text-xs leading-relaxed text-slate-400">{text}</p>
    </div>
  );
}
