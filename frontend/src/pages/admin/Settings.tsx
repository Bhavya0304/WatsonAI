import { Mail, Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { Field, Notice, TextInput, Toggle } from "./form";
import { Panel } from "./ui";

type EmailSettings = {
  enabled: boolean;
  notify_email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string | null;
  from_name: string;
  password_set: boolean;
  configured: boolean;
};

const PRESETS = [
  { label: "Gmail", host: "smtp.gmail.com", port: 465 },
  { label: "Outlook", host: "smtp.office365.com", port: 587 },
  { label: "Zoho", host: "smtp.zoho.com", port: 465 },
];

export default function Settings() {
  const [saved, setSaved] = useState<EmailSettings | null>(null);
  const [form, setForm] = useState<EmailSettings | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<{ email: EmailSettings }>("/api/admin/settings").then((r) => {
      setSaved(r.email);
      setForm(r.email);
    });
  }, []);

  if (!form || !saved) return <p className="text-slate-500">Loading…</p>;
  const set = <K extends keyof EmailSettings>(k: K, v: EmailSettings[K]) => setForm({ ...form, [k]: v });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved) || password.length > 0;

  const save = async () => {
    setBusy("save");
    setMsg(null);
    try {
      const r = await api<{ email: EmailSettings }>("/api/admin/settings/email", {
        method: "PUT",
        json: {
          enabled: form.enabled,
          notify_email: form.notify_email,
          smtp_host: form.smtp_host,
          smtp_port: Number(form.smtp_port),
          smtp_user: form.smtp_user,
          from_name: form.from_name,
          smtp_password: password || null,
        },
      });
      setSaved(r.email);
      setForm(r.email);
      setPassword("");
      setMsg({ kind: "ok", text: "Settings saved. They apply to the next email, no restart needed." });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof ApiError ? e.message : "Save failed" });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setMsg(null);
    try {
      await api("/api/admin/settings/email/test", { method: "POST" });
      setMsg({ kind: "ok", text: `Test email sent to ${saved.notify_email}. Check your inbox 📬` });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof ApiError ? e.message : "Test failed" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Panel title="Session transcript emails">
        <div className="space-y-5">
          <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} label="Email me the full transcript when a visitor's session ends" />
          <p className="text-xs text-slate-500">
            When this is off, sessions are still saved and visible under Sessions; Watson just won't email them. Turning it back on doesn't
            send the backlog.
          </p>
          <Field label="Send transcripts to">
            <TextInput type="email" value={form.notify_email} onChange={(v) => set("notify_email", v)} placeholder="you@example.com" />
          </Field>
        </div>
      </Panel>

      <Panel
        title="SMTP server"
        action={
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${form.configured ? "border-emerald-300/30 text-emerald-300" : "border-amber-300/30 text-amber-300"}`}>
            {saved.configured ? "configured" : "incomplete"}
          </span>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="btn-ghost py-1 text-xs" onClick={() => setForm({ ...form, smtp_host: p.host, smtp_port: p.port })}>
                <Mail className="h-3.5 w-3.5" /> {p.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="Host">
              <TextInput value={form.smtp_host} onChange={(v) => set("smtp_host", v)} placeholder="smtp.gmail.com" />
            </Field>
            <Field label="Port" hint="465 = SSL, 587 = STARTTLS">
              <TextInput type="number" value={form.smtp_port} onChange={(v) => set("smtp_port", Number(v) || 0)} />
            </Field>
          </div>
          <Field label="Username (sending address)">
            <TextInput value={form.smtp_user} onChange={(v) => set("smtp_user", v)} placeholder="you@gmail.com" autoComplete="off" />
          </Field>
          <Field
            label="Password / App password"
            hint={
              saved.password_set
                ? "A password is saved. Leave this empty to keep it, or type a new one to replace it."
                : "For Gmail, create an App Password at myaccount.google.com/apppasswords (requires 2-step verification)."
            }
          >
            <TextInput type="password" value={password} onChange={setPassword} placeholder={saved.password_set ? "••••••••  (saved)" : "app password"} autoComplete="new-password" />
          </Field>
          <Field label="Sender name">
            <TextInput value={form.from_name} onChange={(v) => set("from_name", v)} placeholder="Watson" />
          </Field>
        </div>
      </Panel>

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={test} disabled={busy !== null || dirty || !saved.configured} title={dirty ? "Save first" : ""}>
          <Send className="h-4 w-4" /> {busy === "test" ? "Sending…" : "Send test email"}
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy !== null || !dirty}>
          <Save className="h-4 w-4" /> {busy === "save" ? "Saving…" : "Save settings"}
        </button>
      </div>
      <p className="text-center text-[11px] text-slate-600">
        Settings are stored in the server's database. Anything left empty falls back to the values in <code>.env</code>.
      </p>
    </div>
  );
}
