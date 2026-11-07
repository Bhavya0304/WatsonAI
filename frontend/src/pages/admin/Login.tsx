import { Lock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Background from "../../components/Background";
import Orb from "../../components/Orb";
import { api, ApiError } from "../../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/login", { json: { username, password } });
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center px-4">
      <Background />
      <form onSubmit={submit} className="glass-strong w-full max-w-sm space-y-4 rounded-3xl p-6 shadow-glow">
        <div className="flex flex-col items-center gap-3 pb-2">
          <Orb size={56} />
          <h1 className="text-xl font-semibold text-white">Watson control room</h1>
          <p className="text-sm text-slate-400">Bhavya-only zone 🔒</p>
        </div>
        <input className="input" placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input
          className="input"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button type="submit" className="btn-primary w-full justify-center" disabled={busy || !username || !password}>
          <Lock className="h-4 w-4" /> {busy ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
