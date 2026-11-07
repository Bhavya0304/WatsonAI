"""Riddle mini-game. General brain teasers (not trivia about Bhavya) that get harder as the
visitor's win streak grows. The model judges guesses and banters; the backend owns the state
(which riddle, attempts, score, streak) so the model can't lose track or leak answers."""

import json
import random
import re

from ..config import get_settings
from ..content import get_content

EMPTY = {"active": None, "attempts": 0, "seen": [], "score": 0, "asked": 0, "streak": 0, "best_streak": 0}
LEVELS = ("easy", "medium", "hard")
LEVEL_NAMES = {"easy": "Warm-up", "medium": "Level up", "hard": "Boss round"}


def load(raw: str | None) -> dict:
    try:
        state = {**EMPTY, **json.loads(raw or "{}")}
    except json.JSONDecodeError:
        state = dict(EMPTY)
    return state


def dump(state: dict) -> str:
    return json.dumps(state)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9.]+", " ", s.lower()).strip()


def matches_answer(riddle: dict, guess: str) -> bool:
    g = f" {_norm(guess)} "
    return any(f" {_norm(a)} " in g for a in [riddle["answer"], *riddle["aliases"]])


def target_level(state: dict, request: str = "") -> str:
    """Explicit asks win ('give me a hard one'); otherwise difficulty follows the win streak."""
    r = request.lower()
    if re.search(r"\b(hard|harder|hardest|difficult|boss|tough|brutal)\b", r):
        return "hard"
    if re.search(r"\b(easy|easier|simple|baby)\b", r):
        return "easy"
    if re.search(r"\b(medium|moderate)\b", r):
        return "medium"
    s = state["streak"]
    return "easy" if s < 2 else "medium" if s < 4 else "hard"


def pick(state: dict, request: str = "") -> dict:
    """Next unseen riddle at the target difficulty, falling back to the nearest level."""
    c = get_content()
    level = target_level(state, request)
    unseen = [r for r in c.riddles if r["id"] not in state["seen"]] or c.riddles
    order = sorted(LEVELS, key=lambda lv: abs(LEVELS.index(lv) - LEVELS.index(level)))
    for lv in order:
        pool = [r for r in unseen if r.get("difficulty", "medium") == lv]
        if pool:
            return random.choice(pool)
    return random.choice(unseen)


def prompt_block(state: dict, pending: dict | None = None) -> str:
    c = get_content()
    max_attempts = get_settings().riddle_max_attempts
    lines = [
        "The riddle game uses GENERAL brain teasers (not questions about Bhavya). "
        f"Visitor's score: {state['score']} solved of {state['asked']} asked; current win streak {state['streak']}, "
        f"best streak {state['best_streak']}."
    ]
    if pending:
        lines += [
            "RIDDLE READY TO PRESENT: if the visitor wants a riddle now, set riddle.action=start and present "
            "EXACTLY this one (the card shows the question, so don't repeat it and NEVER invent a different riddle):",
            f"Question: {pending['question']}",
            f"Answer (secret, never reveal now): {pending['answer']}",
        ]
    elif state["active"] and (r := c.riddle(state["active"])):
        lines += [
            "ACTIVE RIDDLE (the visitor sees it on a card; NEVER reveal the answer unless they solve it or give up):",
            f"Difficulty: {r.get('difficulty', 'medium')}",
            f"Question: {r['question']}",
            f"Answer: {r['answer']} (also accept: {', '.join(r['aliases'])}; be lenient with spelling and articles)",
            f"Hint you may give if they ask or are stuck: {r['hint']}",
            f"Attempts used: {state['attempts']} of {max_attempts}.",
            "If the visitor's message is a guess, set riddle.action to guess_correct or guess_wrong. If they ask for a "
            "hint, give it with flair (action none). If they change topic, use none and the riddle stays open.",
        ]
    else:
        lines.append("No riddle is active. To offer one, ask in your reply (keep action none); the backend serves it.")
    return "\n".join(lines)


def apply(state: dict, action: str, user_message: str, pending: dict | None = None) -> tuple[dict, dict | None]:
    """Returns (new_state, riddle_card or None)."""
    c = get_content()
    max_attempts = get_settings().riddle_max_attempts
    active = c.riddle(state["active"]) if state["active"] else None

    # Server-side safety net: an exact answer/alias match is always correct.
    if active and action in ("none", "guess_wrong") and matches_answer(active, user_message):
        action = "guess_correct"

    def card(r: dict, status: str, reveal: bool = False) -> dict:
        level = r.get("difficulty", "medium")
        out = {"id": r["id"], "question": r["question"], "hint": r["hint"], "status": status,
               "difficulty": level, "level_name": LEVEL_NAMES.get(level, level),
               "attempts": state["attempts"], "max_attempts": max_attempts,
               "score": state["score"], "asked": state["asked"],
               "streak": state["streak"], "best_streak": state["best_streak"]}
        if reveal:
            out["answer"] = r["answer"]
        return out

    if action == "start":
        if active:
            return state, card(active, "active")
        if not pending:  # the model only ever presents a riddle we put in its prompt
            return state, None
        r = pending
        if all(x["id"] in state["seen"] for x in c.riddles):
            state["seen"] = []
        state.update(active=r["id"], attempts=0, asked=state["asked"] + 1)
        state["seen"].append(r["id"])
        return state, card(r, "active")

    if not active:
        return state, None

    if action == "guess_correct":
        state["score"] += 1
        state["streak"] += 1
        state["best_streak"] = max(state["best_streak"], state["streak"])
        state["active"] = None
        return state, card(active, "solved", reveal=True)

    if action == "guess_wrong":
        state["attempts"] += 1
        if state["attempts"] >= max_attempts:
            state["active"] = None
            state["streak"] = 0
            return state, card(active, "revealed", reveal=True)
        return state, card(active, "wrong")

    if action == "reveal":
        state["active"] = None
        state["streak"] = 0
        return state, card(active, "revealed", reveal=True)

    return state, None
