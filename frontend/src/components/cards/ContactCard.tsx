import { Check, Copy, Github, Globe, Linkedin, Mail } from "lucide-react";
import { useState } from "react";
import type { Contact } from "../../lib/types";
import CardShell, { CardLabel } from "./CardShell";

const ICON: Record<string, typeof Github> = { GitHub: Github, LinkedIn: Linkedin, Website: Globe };

export default function ContactCard({ contact, delay }: { contact: Contact; delay?: number }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; the mailto link still works */
    }
  };

  return (
    <CardShell delay={delay}>
      <CardLabel>Reach Bhavya</CardLabel>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2 pl-3">
        <Mail className="h-4 w-4 shrink-0 text-violet-300" />
        <a href={`mailto:${contact.email}`} className="min-w-0 flex-1 truncate text-sm text-white hover:text-cyan-200">
          {contact.email}
        </a>
        <button type="button" onClick={copy} className="btn-ghost px-2 py-1 text-xs" aria-label="Copy email">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {contact.links.map((l) => {
          const Icon = ICON[l.label] ?? Globe;
          return (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 py-3 text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
            >
              <Icon className="h-5 w-5" />
              {l.label}
            </a>
          );
        })}
      </div>
    </CardShell>
  );
}
