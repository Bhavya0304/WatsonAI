"""Watson: assembles the prompt, routes to a model, parses the structured reply and
applies its side effects (visitor info, riddle state)."""

import json
import random
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator

from .. import db
from ..config import get_settings
from ..content import get_content
from ..llm.router import complete
from ..rag.retrieve import retrieve
from . import riddles

CARD_TYPES = {"project", "experience", "skills", "contact", "profile"}
RELATIONS = {"recruiter", "colleague", "friend", "engineer", "student", "explorer", "other"}
RIDDLE_WORDS = re.compile(r"riddle|puzzle|brain ?teaser|🧩", re.IGNORECASE)
# "another one" / "next" right after a riddle card means: keep the game going
CONTINUE_WORDS = re.compile(r"\b(another|next|one more|again|hit me|go on|more|harder|easier)\b", re.IGNORECASE)
DEFAULT_SUGGESTIONS = ["What has he built?", "Play a riddle game 🧩", "How do I contact him?"]

OPENERS = [
    "Oh good, a human 👀 I'm **Watson**, Bhavya's AI sidekick, part-time hype man, full-time keeper of his secrets. "
    "So, how do you know Bhavya? (Choose wisely. I *will* judge.)",
    "Welcome! I'm **Watson** 🤖 Think of me as Bhavya's portfolio, but one that talks back and occasionally sasses. "
    "First things first: how do you know Bhavya?",
    "Hey there 👋 I'm **Watson**. I know Bhavya's projects, career and exactly how many side projects he's "
    "*definitely* going to finish. How do you know him?",
    "A visitor! Quick, everyone act natural 😎 I'm **Watson**, Bhavya's AI agent. "
    "Before I start spilling the tea, how do you know Bhavya?",
]
OPENER_CHIPS = ["I'm hiring / a recruiter", "We've worked together", "I'm his friend", "Just here for the riddles 🧩"]

RIDDLE_INTROS = {
    "easy": [
        "Warm-up round 🧩 Nice and gentle, so no pressure. (There's a little pressure.) 👇",
        "Easy one. If you miss this, we need to talk 🧠 👇",
        "Here's a gentle one. Three guesses, hints allowed, judgement included 👇",
        "Brain, meet riddle. Riddle, meet brain 🤝 👇",
    ],
    "medium": [
        "Ooh, you're on a roll 😏 Turning the difficulty up a notch 👇",
        "Level up! 📈 The training wheels are coming off 👇",
        "Okay, smarty-pants. Let's see how you handle this one 👇",
    ],
    "hard": [
        "🔥 BOSS ROUND 🔥 Grown adults have cried over this one. Good luck 👇",
        "You asked for it. Hard mode activated 💀 Three guesses. No refunds 👇",
        "Streak like that? You've earned a nasty one 😈 👇",
    ],
}
RIDDLE_CHIPS = ["Give me a hint 💡", "I give up 🏳️"]

EXHAUSTED_REPLY = (
    "Phew, I've talked so much today that every one of my brain cells is on a coffee break ☕😅 "
    "Can we pick this up a bit later? Meanwhile, here's how to reach Bhavya directly 👇"
)


# ---------------------------------------------------------------- reply schema

class Card(BaseModel):
    type: str
    id: str = "all"


class Visitor(BaseModel):
    name: str | None = None
    relation: str | None = None
    company: str | None = None
    email: str | None = None
    declined: bool = False


class RiddleAction(BaseModel):
    action: Literal["none", "start", "guess_correct", "guess_wrong", "reveal"] = "none"


class AgentReply(BaseModel):
    reply: str
    cards: list[Card] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    visitor: Visitor = Field(default_factory=Visitor)
    riddle: RiddleAction = Field(default_factory=RiddleAction)

    @field_validator("riddle", mode="before")
    @classmethod
    def _riddle_lenient(cls, v):
        if isinstance(v, dict) and v.get("action") not in RiddleAction.model_fields["action"].annotation.__args__:
            return {"action": "none"}
        return v or {"action": "none"}

    @field_validator("visitor", mode="before")
    @classmethod
    def _visitor_lenient(cls, v):
        return v if isinstance(v, dict) else {}


def parse_reply(text: str) -> AgentReply:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    start, end = cleaned.find("{"), cleaned.rfind("}")
    try:
        data = json.loads(cleaned[start:end + 1] if start != -1 else cleaned)
        return AgentReply.model_validate(data)
    except (json.JSONDecodeError, ValidationError, TypeError):
        return AgentReply(reply=text.strip())


def sanitize_cards(cards: list[Card]) -> list[dict]:
    c = get_content()
    valid: list[dict] = []
    for card in cards:
        t = card.type.lower()
        if t not in CARD_TYPES:
            continue
        if t == "project" and card.id not in c.project_ids:
            continue
        if t == "experience" and card.id not in (*c.experience_ids, "all"):
            card.id = "all"
        if t in ("skills", "contact", "profile"):
            card.id = "all"
        entry = {"type": t, "id": card.id}
        if entry not in valid:
            valid.append(entry)
    return valid[:3]


def sanitize_suggestions(items: list[str]) -> list[str]:
    out = [s.strip()[:60] for s in items if isinstance(s, str) and s.strip()]
    return out[:3] or DEFAULT_SUGGESTIONS


# ---------------------------------------------------------------- prompt

def visitor_block(session: dict) -> str:
    known = {
        "name": session.get("visitor_name"),
        "relation to Bhavya": session.get("visitor_relation"),
        "company/role": session.get("visitor_company"),
        "email": session.get("visitor_email"),
    }
    lines = [f"- {k}: {v}" for k, v in known.items() if v]
    if session.get("visitor_declined"):
        lines.append("- The visitor prefers privacy. NEVER ask for their name, company, email or any personal info again.")
    else:
        missing = [k for k, v in known.items() if not v and k != "email"]
        if missing:
            lines.append(f"- Not known yet: {', '.join(missing)}. You may ask casually ONCE if it fits naturally.")
    return "\n".join(lines) or "- Nothing known yet."


def build_messages(session: dict, history: list[dict], user_message: str, riddle_state: dict,
                   pending_riddle: dict | None = None) -> list[dict]:
    c = get_content()
    prev_user = [m["content"] for m in history if m["role"] == "user"][-1:]
    chunks = retrieve(user_message, " ".join(prev_user))
    system = "\n\n".join([
        c.persona,
        "## PROJECT IDS\n" + ", ".join(f"{p['id']} ({p['title']})" for p in c.projects),
        "## EXPERIENCE IDS\n" + ", ".join(f"{e['id']} ({e['company']})" for e in c.experience),
        "## KNOWLEDGE (core profile)\n" + c.core_profile(),
        "## KNOWLEDGE (retrieved for this message)\n" + ("\n---\n".join(chunks) or "(nothing extra)"),
        "## VISITOR\n" + visitor_block(session),
        "## RIDDLES\n" + riddles.prompt_block(riddle_state),
        f"## SESSION\nThis is visitor message #{session.get('user_message_count', 0) + 1}. "
        "Respond with the JSON object only.",
    ])
    msgs: list[dict] = [{"role": "system", "content": system}]
    for m in history:
        if m["role"] in ("user", "assistant"):
            msgs.append({"role": m["role"], "content": m["content"]})
    msgs.append({"role": "user", "content": user_message})
    return msgs


# ---------------------------------------------------------------- public API

def opener() -> dict:
    return {"reply": random.choice(OPENERS), "cards": [], "suggestions": OPENER_CHIPS}


def apply_visitor(session_id: str, v: Visitor) -> None:
    updates = {}
    if v.name:
        updates["visitor_name"] = v.name.strip()[:80]
    if v.relation and v.relation.lower() in RELATIONS:
        updates["visitor_relation"] = v.relation.lower()
    if v.company:
        updates["visitor_company"] = v.company.strip()[:120]
    if v.email and re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v.email.strip()):
        updates["visitor_email"] = v.email.strip()[:160]
    if v.declined:
        updates["visitor_declined"] = 1
    db.update_session(session_id, **updates)


def riddle_intro(card: dict) -> str:
    return random.choice(RIDDLE_INTROS.get(card.get("difficulty", "medium"), RIDDLE_INTROS["medium"]))


def start_riddle(sid: str, user_message: str, rstate: dict, riddle: dict) -> dict:
    db.add_message(sid, "user", user_message)
    rstate, card = riddles.apply(rstate, "start", user_message, riddle)
    db.update_session(sid, riddle_state=riddles.dump(rstate))
    reply = riddle_intro(card)
    db.add_message(sid, "assistant", reply, [{"type": "riddle", "id": card["id"], "status": "active"}],
                   RIDDLE_CHIPS, "scripted")
    db.touch_session(sid, "scripted", 0.0)
    return {"reply": reply, "cards": [], "suggestions": RIDDLE_CHIPS, "riddle": card, "provider": "scripted"}


def respond(session: dict, user_message: str, ip: str) -> dict:
    s = get_settings()
    sid = session["id"]
    history = db.get_messages(sid, limit=s.history_messages)
    rstate = riddles.load(session.get("riddle_state"))

    last_bot_msg = next((m for m in reversed(history) if m["role"] == "assistant"), None)
    last_bot = last_bot_msg["content"] if last_bot_msg else ""
    just_played = bool(last_bot_msg and any(c.get("type") == "riddle" for c in last_bot_msg["cards"]))
    pending = None
    if not rstate["active"]:
        wants_riddle = RIDDLE_WORDS.search(user_message) or (
            just_played and CONTINUE_WORDS.search(user_message) and len(user_message) < 60)
        if wants_riddle:
            # Visitor asked for a riddle: answer deterministically (no LLM, no cost) so the
            # message and the card can never disagree about which riddle it is.
            return start_riddle(sid, user_message, rstate, riddles.pick(rstate, user_message))
        if RIDDLE_WORDS.search(last_bot):
            pending = riddles.pick(rstate, user_message)  # Watson offered one; the model may start it

    db.add_message(sid, "user", user_message)
    result = complete(build_messages(session, history, user_message, rstate, pending), sid, ip)

    if result.text is None:
        payload = {"reply": EXHAUSTED_REPLY, "cards": [{"type": "contact", "id": "all"}],
                   "suggestions": ["Okay, see you later 👋"], "riddle": None, "provider": None}
        db.add_message(sid, "assistant", EXHAUSTED_REPLY, payload["cards"], payload["suggestions"])
        db.touch_session(sid, None, 0.0)
        return payload

    parsed = parse_reply(result.text)
    cards = sanitize_cards(parsed.cards)
    suggestions = sanitize_suggestions(parsed.suggestions)
    apply_visitor(sid, parsed.visitor)
    rstate, riddle_card = riddles.apply(rstate, parsed.riddle.action, user_message, pending)
    db.update_session(sid, riddle_state=riddles.dump(rstate))
    if riddle_card and riddle_card["status"] == "active" and pending:
        # Models love writing their own riddle text; replace it so it matches the card.
        parsed.reply = riddle_intro(riddle_card)
        suggestions = RIDDLE_CHIPS
    elif riddle_card and riddle_card["status"] in ("solved", "revealed"):
        nxt = "Harder one 😈" if riddle_card["status"] == "solved" and riddle_card["streak"] >= 2 else "Next riddle 🧩"
        suggestions = [nxt] + [x for x in suggestions if not RIDDLE_WORDS.search(x)][:2]
    elif (riddle_card and riddle_card["status"] in ("active", "wrong")) or (not riddle_card and rstate["active"]):
        suggestions = RIDDLE_CHIPS  # mid-game: keep the game controls handy
    if riddle_card:
        cards = []  # riddle turns stay focused on the game

    stored_cards = cards + ([{"type": "riddle", "id": riddle_card["id"], "status": riddle_card["status"]}]
                            if riddle_card else [])
    db.add_message(sid, "assistant", parsed.reply, stored_cards, suggestions, result.provider)
    db.touch_session(sid, result.provider, result.cost)

    return {"reply": parsed.reply, "cards": cards, "suggestions": suggestions,
            "riddle": riddle_card, "provider": result.provider}
