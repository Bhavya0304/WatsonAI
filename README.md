# Watson: Bhavya Joshi's portfolio agent

My portfolio is a conversation. Watson is an AI agent that visitors talk to. It:

- **Starts the conversation.** It opens by asking how you know me, and nudges you if you go quiet.
- **Shows rich cards in the chat** for projects, the experience timeline, the skill tree, the profile and contact details.
- **Suggests what to ask next** with tappable follow-up chips.
- **Tells riddles about me.** It keeps score, offers hints, and lets you give up gracefully.
- **Asks who you are, casually.** If you'd rather not say, it never asks again.
- **Emails me the full transcript** when a conversation ends.

## Architecture

```
frontend/  React + Vite + Tailwind + framer-motion   →  static files served by Nginx
backend/   FastAPI (single process)                  →  /api/*
content/   persona, profile, projects, experience, riddles  (the knowledge base)
db/        SQLite + Chroma vector index  (runtime, gitignored)
logs/      app.log: JSON lines, rotated daily, 30 files kept  (gitignored)
```

**A single turn:**
1. The visitor's message is embedded (Chroma's built-in ONNX MiniLM).
2. The top-k content chunks plus a compact core profile go into the prompt, with visitor and riddle state.
3. The model returns strict JSON: `{reply, cards, suggestions, visitor, riddle}`.
4. The backend validates the JSON, applies its side effects (visitor info, riddle score), and sends it to the UI.

### Model routing and budget

| Order | Provider | Limits |
|---|---|---|
| 1 | OpenAI `gpt-4.1-mini` | $0.10 per session · $0.20 per IP per day · $2 per month · $14 lifetime, or OpenAI reports `insufficient_quota` |
| 2 | Gemini `gemini-2.5-flash` (free tier) | 429 → 60 s cooldown · daily quota → cooldown until the next Pacific midnight |
| 3 | Groq `llama-3.3-70b-versatile` (free tier) | 429 → cooldown |
| — | none available | A friendly "I'm exhausted" reply plus the contact card |

Every call's tokens and cost are stored. The dashboard shows how much budget is left, and **Reset** re-enables OpenAI after a top-up. All limits can be changed in `.env`.

## Running locally

```bash
cp .env.example .env          # then fill in keys, admin password, SECRET_KEY
uv sync
uv run uvicorn app.main:app --app-dir backend --reload --port 8000
```

```bash
cd frontend && npm install && npm run dev     # http://localhost:5173  (proxies /api → :8000)
```

The admin dashboard is at `/admin`. It uses `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`.

> On first start, Chroma downloads its ~80 MB ONNX embedding model once.

## Deploying (Linux + Nginx)

1. Copy the repo to `/srv/watson`, run `uv sync`, and create `.env` with `COOKIE_SECURE=true`.
2. Run `cd frontend && npm ci && npm run build`.
3. Install [deploy/watson.service](deploy/watson.service) (systemd) and [deploy/nginx.conf](deploy/nginx.conf), then run `certbot --nginx`.

Keep `--workers 1`. The rate limiter, login lockout and session reaper all live in that one process.

## Updating content

Edit the files in `content/` and restart. The vector index rebuilds automatically when the content changes.

| File | What it holds |
|---|---|
| `persona.md` | Watson's personality, rules and JSON reply format |
| `profile.md` | About, education, skills and philosophy (one chunk per `#` section) |
| `projects.json` / `experience.json` | Retrieval chunks, and the data behind the in-chat cards |
| `riddles.json` | Question, answer, accepted aliases and hint |
| `contact.json` | Public contact details |

## License

MIT
