/** Fixed ambient backdrop: drifting gradient blobs over a faint grid. Pure CSS, no canvas. */
export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950" aria-hidden>
      <div className="absolute -left-32 -top-32 h-[520px] w-[520px] animate-drift rounded-full bg-violet-600/25 blur-[120px]" />
      <div
        className="absolute -bottom-40 -right-24 h-[560px] w-[560px] animate-drift rounded-full bg-cyan-500/20 blur-[130px]"
        style={{ animationDelay: "-9s" }}
      />
      <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[110px]" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
}
