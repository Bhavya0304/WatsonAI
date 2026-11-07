import { Plus, Trash2 } from "lucide-react";
import type { Contact, Experience, Link, Project } from "../../../lib/types";
import { Field, LinesInput, TagInput, TextArea, TextInput } from "../form";
import ItemList from "./ItemList";

export type ProfileSection = { title: string; body: string };
export type RiddleItem = { id: string; difficulty: "easy" | "medium" | "hard"; question: string; answer: string; aliases: string[]; hint: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ---------------------------------------------------------------- links

function LinksEditor({ links, onChange }: { links: Link[]; onChange: (l: Link[]) => void }) {
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex gap-2">
          <input className="input w-32" placeholder="Label" value={l.label} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input className="input flex-1" placeholder="https://…" value={l.url} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          <button type="button" className="btn-ghost p-2" onClick={() => onChange(links.filter((_, j) => j !== i))} aria-label="Remove link">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" className="btn-ghost py-1 text-xs" onClick={() => onChange([...links, { label: "", url: "" }])}>
        <Plus className="h-3.5 w-3.5" /> Add link
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- profile

const PROFILE_HINTS: Record<string, string> = {
  "About Bhavya": "Shown on the Profile card and used as the main bio.",
  Education: "Shown on the Profile card.",
  "Engineering Philosophy": "First sentence is shown on the Profile card.",
  "Current Interests": "Shown on the Profile card.",
};

export function ProfileEditor({ value, onChange }: { value: ProfileSection[]; onChange: (v: ProfileSection[]) => void }) {
  return (
    <ItemList
      items={value}
      onChange={onChange}
      noun="section"
      label={(s) => s.title}
      sublabel={(s) => `${s.body.length} chars`}
      makeNew={() => ({ title: "New section", body: "" })}
      renderForm={(s, update) => (
        <>
          <Field
            label="Section title"
            hint={
              PROFILE_HINTS[s.title] ??
              (s.title.startsWith("Core Expertise:")
                ? "Appears as a group on the Skills card. Write the skills comma-separated."
                : "Tip: titles starting with “Core Expertise:” become groups on the Skills card.")
            }
          >
            <TextInput value={s.title} onChange={(v) => update({ title: v })} />
          </Field>
          <Field label="Content" hint="Plain text. Each section becomes one searchable chunk for Watson.">
            <TextArea rows={10} value={s.body} onChange={(v) => update({ body: v })} />
          </Field>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- projects

export function ProjectsEditor({ value, onChange }: { value: Project[]; onChange: (v: Project[]) => void }) {
  return (
    <ItemList
      items={value}
      onChange={onChange}
      noun="project"
      label={(p) => `${p.emoji} ${p.title}`}
      sublabel={(p) => `${p.id} · ${p.status}`}
      makeNew={() => ({ id: "", title: "", emoji: "✨", tagline: "", description: "", highlights: [], tech: [], skills: [], status: "Built", links: [] })}
      renderForm={(p, update) => (
        <>
          <div className="grid gap-4 sm:grid-cols-[80px_1fr_1fr]">
            <Field label="Emoji">
              <TextInput value={p.emoji} onChange={(v) => update({ emoji: v })} maxLength={8} />
            </Field>
            <Field label="Title">
              <TextInput value={p.title} onChange={(v) => update({ title: v, ...(!p.id || p.id === slugify(p.title) ? { id: slugify(v) } : {}) })} />
            </Field>
            <Field label="ID" hint="lowercase-with-dashes; Watson uses it to show this card">
              <TextInput value={p.id} onChange={(v) => update({ id: slugify(v) })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Tagline" hint="One line shown under the title on the card">
              <TextInput value={p.tagline} onChange={(v) => update({ tagline: v })} />
            </Field>
            <Field label="Status">
              <TextInput value={p.status} onChange={(v) => update({ status: v })} list="project-status" />
              <datalist id="project-status">
                {["Active", "Live", "Built", "In production", "Research", "Paused"].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label="Description" hint="The full story. Watson reads this when answering questions about the project.">
            <TextArea rows={5} value={p.description} onChange={(v) => update({ description: v })} />
          </Field>
          <Field label="Highlights" hint="One per line">
            <LinesInput value={p.highlights} onChange={(v) => update({ highlights: v })} />
          </Field>
          <Field label="Technologies">
            <TagInput value={p.tech} onChange={(v) => update({ tech: v })} />
          </Field>
          <Field label="Skills demonstrated">
            <TagInput value={p.skills} onChange={(v) => update({ skills: v })} />
          </Field>
          <Field label="Links">
            <LinksEditor links={p.links} onChange={(v) => update({ links: v })} />
          </Field>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- experience

export function ExperienceEditor({ value, onChange }: { value: Experience[]; onChange: (v: Experience[]) => void }) {
  return (
    <ItemList
      items={value}
      onChange={onChange}
      noun="role"
      label={(e) => `${e.title} @ ${e.company}`}
      sublabel={(e) => `${e.start} – ${e.end}`}
      makeNew={() => ({ id: "", title: "", company: "", location: "", start: "", end: "Present", company_blurb: "", summary: "", highlights: [], tech: [] })}
      renderForm={(e, update) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title">
              <TextInput value={e.title} onChange={(v) => update({ title: v })} />
            </Field>
            <Field label="Company">
              <TextInput value={e.company} onChange={(v) => update({ company: v, ...(!e.id || e.id === slugify(e.company) ? { id: slugify(v) } : {}) })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="ID">
              <TextInput value={e.id} onChange={(v) => update({ id: slugify(v) })} />
            </Field>
            <Field label="Location">
              <TextInput value={e.location} onChange={(v) => update({ location: v })} />
            </Field>
            <Field label="Start" hint="e.g. Aug 2025">
              <TextInput value={e.start} onChange={(v) => update({ start: v })} />
            </Field>
            <Field label="End" hint="“Present” if current">
              <TextInput value={e.end} onChange={(v) => update({ end: v })} />
            </Field>
          </div>
          <Field label="What you do there" hint="Shown on the timeline card">
            <TextArea rows={4} value={e.summary} onChange={(v) => update({ summary: v })} />
          </Field>
          <Field label="About the company" hint="Context for Watson, shown on the detailed card">
            <TextArea rows={3} value={e.company_blurb} onChange={(v) => update({ company_blurb: v })} />
          </Field>
          <Field label="Highlights" hint="One per line">
            <LinesInput value={e.highlights} onChange={(v) => update({ highlights: v })} />
          </Field>
          <Field label="Tags">
            <TagInput value={e.tech} onChange={(v) => update({ tech: v })} />
          </Field>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- contact

export function ContactEditor({ value, onChange }: { value: Contact; onChange: (v: Contact) => void }) {
  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <TextInput value={value.name} onChange={(v) => set("name", v)} />
        </Field>
        <Field label="Public email" hint="Shown on the contact card. Watson shares it.">
          <TextInput type="email" value={value.email} onChange={(v) => set("email", v)} />
        </Field>
      </div>
      <Field label="Headline">
        <TextInput value={value.headline} onChange={(v) => set("headline", v)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currently" hint="Shown with a live dot on the profile rail">
          <TextInput value={value.current} onChange={(v) => set("current", v)} />
        </Field>
        <Field label="Location">
          <TextInput value={value.location} onChange={(v) => set("location", v)} />
        </Field>
      </div>
      <Field label="Links" hint="Labels GitHub, LinkedIn and Website get their icons">
        <LinksEditor links={value.links} onChange={(v) => set("links", v)} />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------- riddles

export function RiddlesEditor({ value, onChange }: { value: RiddleItem[]; onChange: (v: RiddleItem[]) => void }) {
  const nextId = () => {
    const nums = value.map((r) => Number(r.id.replace(/\D/g, "")) || 0);
    return `r${Math.max(0, ...nums) + 1}`;
  };
  return (
    <ItemList
      items={value}
      onChange={onChange}
      noun="riddle"
      label={(r) => r.question}
      sublabel={(r) => `${r.difficulty} · answer: ${r.answer}`}
      makeNew={(): RiddleItem => ({ id: nextId(), difficulty: "medium", question: "", answer: "", aliases: [], hint: "" })}
      renderForm={(r, update) => (
        <>
          <p className="text-xs text-slate-500">
            General brain teasers for the riddle game. Visitors start on easy ones; difficulty rises with their win streak (2 wins → medium, 4 → hard), or
            they can ask for a harder or easier one.
          </p>
          <Field label="Difficulty">
            <div className="flex gap-2">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => update({ difficulty: d })}
                  className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition ${
                    r.difficulty === d ? "border-violet-400/60 bg-violet-500/20 text-white" : "border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {d === "easy" ? "🟢" : d === "medium" ? "🟡" : "🔴"} {d}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Question">
            <TextArea rows={3} value={r.question} onChange={(v) => update({ question: v })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Answer">
              <TextInput value={r.answer} onChange={(v) => update({ answer: v })} />
            </Field>
            <Field label="Hint">
              <TextInput value={r.hint} onChange={(v) => update({ hint: v })} />
            </Field>
          </div>
          <Field label="Also accept" hint="Other spellings counted as correct. Avoid common words like “you”.">
            <TagInput value={r.aliases} onChange={(v) => update({ aliases: v })} />
          </Field>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- persona

export function PersonaEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-300/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
        Advanced: this is Watson's system prompt. Keep the <strong>Output format</strong> section intact. Watson's cards, chips and riddles depend on
        it. A backup is saved on every change.
      </div>
      <TextArea rows={28} mono value={value} onChange={onChange} />
    </div>
  );
}
