import { Briefcase, Contact as ContactIcon, Database, Puzzle, RefreshCw, Rocket, Save, ScrollText, Undo2, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../lib/api";
import type { Contact, Experience, Project } from "../../lib/types";
import { ContactEditor, ExperienceEditor, PersonaEditor, ProfileEditor, ProjectsEditor, RiddlesEditor, type ProfileSection, type RiddleItem } from "./content/editors";
import { Notice } from "./form";
import { fmtTime } from "./ui";

type Editable = {
  profile: ProfileSection[];
  projects: Project[];
  experience: Experience[];
  contact: Contact;
  riddles: RiddleItem[];
  persona: string;
};
type IndexStatus = { chunks: number; indexed_at: string | null; up_to_date: boolean };
type Section = keyof Editable;

const TABS: { key: Section; label: string; icon: typeof User }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "projects", label: "Projects", icon: Rocket },
  { key: "experience", label: "Experience", icon: Briefcase },
  { key: "contact", label: "Contact", icon: ContactIcon },
  { key: "riddles", label: "Riddles", icon: Puzzle },
  { key: "persona", label: "Persona", icon: ScrollText },
];

export default function ContentPage() {
  const [saved, setSaved] = useState<Editable | null>(null);
  const [draft, setDraft] = useState<Editable | null>(null);
  const [index, setIndex] = useState<IndexStatus | null>(null);
  const [tab, setTab] = useState<Section>("profile");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [rev, setRev] = useState(0); // remounts editors after save/discard so inputs reset

  useEffect(() => {
    api<{ content: Editable; index: IndexStatus }>("/api/admin/content").then((r) => {
      setSaved(r.content);
      setDraft(r.content);
      setIndex(r.index);
    });
  }, []);

  const dirty = useMemo(() => {
    if (!saved || !draft) return new Set<Section>();
    return new Set(TABS.map((t) => t.key).filter((k) => JSON.stringify(saved[k]) !== JSON.stringify(draft[k])));
  }, [saved, draft]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.size) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ content: Editable; index: IndexStatus }>(`/api/admin/content/${tab}`, { method: "PUT", json: { data: draft[tab] } });
      setSaved(r.content);
      setDraft((d) => (d ? { ...d, [tab]: r.content[tab] } : r.content));
      setIndex(r.index);
      setRev((x) => x + 1);
      setMsg({ kind: "ok", text: `Saved and re-embedded: ${r.index.chunks} chunks in the vector index. Watson knows the new details from the next message.` });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof ApiError ? e.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }, [draft, tab]);

  const discard = () => {
    if (!saved || !draft) return;
    setDraft({ ...draft, [tab]: saved[tab] });
    setRev((x) => x + 1);
    setMsg(null);
  };

  const reindex = async () => {
    setBusy(true);
    try {
      const r = await api<{ index: IndexStatus }>("/api/admin/content/reindex", { method: "POST" });
      setIndex(r.index);
      setMsg({ kind: "ok", text: `Re-embedded ${r.index.chunks} chunks.` });
    } finally {
      setBusy(false);
    }
  };

  if (!draft) return <p className="text-slate-500">Loading…</p>;
  const set = <K extends Section>(k: K) => (v: Editable[K]) => setDraft({ ...draft, [k]: v });

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Knowledge base</h1>
          <p className="text-sm text-slate-400">Everything Watson knows about you. Saving a section re-creates its embeddings right away.</p>
        </div>
        {index && (
          <div className="glass flex items-center gap-3 rounded-xl px-3 py-2 text-xs">
            <Database className="h-4 w-4 text-cyan-300" />
            <span className="text-slate-300">
              {index.chunks} chunks · indexed {fmtTime(index.indexed_at)}
            </span>
            <span className={index.up_to_date ? "text-emerald-300" : "text-amber-300"}>{index.up_to_date ? "● in sync" : "● stale"}</span>
            <button type="button" onClick={reindex} disabled={busy} className="text-slate-400 hover:text-white" aria-label="Re-embed everything" title="Re-embed everything">
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setMsg(null);
            }}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${
              tab === t.key ? "border-violet-400 text-white" : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {dirty.has(t.key) && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" title="Unsaved changes" />}
          </button>
        ))}
      </div>

      <div key={`${tab}-${rev}`} className="glass rounded-2xl p-4">
        {tab === "profile" && <ProfileEditor value={draft.profile} onChange={set("profile")} />}
        {tab === "projects" && <ProjectsEditor value={draft.projects} onChange={set("projects")} />}
        {tab === "experience" && <ExperienceEditor value={draft.experience} onChange={set("experience")} />}
        {tab === "contact" && <ContactEditor value={draft.contact} onChange={set("contact")} />}
        {tab === "riddles" && <RiddlesEditor value={draft.riddles} onChange={set("riddles")} />}
        {tab === "persona" && <PersonaEditor value={draft.persona} onChange={set("persona")} />}
      </div>

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-xs text-slate-400">
            {dirty.has(tab) ? <span className="text-amber-300">Unsaved changes in {TABS.find((t) => t.key === tab)?.label}</span> : "All changes saved"}
            {dirty.size > (dirty.has(tab) ? 1 : 0) && <span className="ml-2 text-slate-500">(other tabs have unsaved edits too)</span>}
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={discard} disabled={busy || !dirty.has(tab)}>
              <Undo2 className="h-4 w-4" /> Discard
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={busy || !dirty.has(tab)}>
              <Save className="h-4 w-4" /> {busy ? "Saving & embedding…" : "Save & re-embed"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
