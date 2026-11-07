/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070B1A",
          900: "#0B1126",
          800: "#121A36",
          700: "#1B2547",
        },
        violet: { 400: "#A78BFA", 500: "#8B5CF6", 600: "#7C3AED" },
        cyan: { 300: "#67E8F9", 400: "#22D3EE" },
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(139, 92, 246, 0.55)",
        "glow-cyan": "0 0 40px -10px rgba(34, 211, 238, 0.5)",
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(30px, -20px) scale(1.08)" },
        },
        spinslow: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        drift: "drift 18s ease-in-out infinite",
        spinslow: "spinslow 12s linear infinite",
      },
    },
  },
  plugins: [],
};
