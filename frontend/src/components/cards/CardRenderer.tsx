import type { CardRef, Content } from "../../lib/types";
import ContactCard from "./ContactCard";
import ExperienceCard from "./ExperienceCard";
import ProfileCard from "./ProfileCard";
import ProjectCard from "./ProjectCard";
import SkillsCard from "./SkillsCard";

export default function CardRenderer({
  cards,
  content,
  onAsk,
}: {
  cards: CardRef[];
  content: Content | null;
  onAsk: (q: string) => void;
}) {
  if (!content || cards.length === 0) return null;
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {cards.map((c, i) => {
        const delay = 0.08 * i + 0.1;
        const key = `${c.type}:${c.id}`;
        switch (c.type) {
          case "project": {
            const p = content.projects.find((x) => x.id === c.id);
            return p ? (
              <ProjectCard
                key={key}
                project={p}
                onAsk={onAsk}
                delay={delay}
              />
            ) : null;
          }
          case "experience":
            return <ExperienceCard key={key} items={content.experience} focusId={c.id} delay={delay} />;
          case "skills":
            return <SkillsCard key={key} groups={content.skills} delay={delay} />;
          case "contact":
            return <ContactCard key={key} contact={content.contact} delay={delay} />;
          case "profile":
            return <ProfileCard key={key} content={content} delay={delay} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
