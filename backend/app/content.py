"""Loads the portfolio content in content/ once and exposes it to the agent, RAG and API."""

import hashlib
import json

from dataclasses import dataclass, field
from functools import lru_cache

from .config import get_settings


@dataclass
class Content:
    persona: str
    profile_md: str
    projects: list[dict]
    experience: list[dict]
    contact: dict
    riddles: list[dict]
    digest: str
    profile_sections: dict[str, str] = field(default_factory=dict)

    @property
    def project_ids(self) -> list[str]:
        return [p["id"] for p in self.projects]

    @property
    def experience_ids(self) -> list[str]:
        return [e["id"] for e in self.experience]

    def riddle(self, riddle_id: str) -> dict | None:
        return next((r for r in self.riddles if r["id"] == riddle_id), None)

    def skills_groups(self) -> list[dict]:
        groups = []
        for title, body in self.profile_sections.items():
            if title.startswith("Core Expertise:"):
                items = [s.strip() for s in body.strip().rstrip(".").split(",") if s.strip()]
                # "x, y and z" → split only the final " and " so "authentication and authorization" survives
                if items and " and " in items[-1]:
                    items[-1:] = [s.strip() for s in items[-1].rsplit(" and ", 1)]
                groups.append({"title": title.split(":", 1)[1].strip(), "items": items})
        return groups

    def core_profile(self) -> str:
        """Compact always-on context so Watson knows the basics even if retrieval misses."""
        c = self.contact
        roles = "; ".join(f"{e['title']} at {e['company']} ({e['start']}–{e['end']})" for e in self.experience)
        projects = ", ".join(f"{p['title']} ({p['tagline']})" for p in self.projects)
        return (
            f"{c['name']}: {c['headline']}. Based in {c['location']}. Currently {c['current']}.\n"
            f"Roles: {roles}.\n"
            f"Education: {self.profile_sections.get('Education', '')}\n"
            f"Projects: {projects}.\n"
            f"Contact: email {c['email']}; " + ", ".join(f"{l['label']} {l['url']}" for l in c["links"])
        )

    def public_payload(self) -> dict:
        """Card data for the frontend (no riddle answers)."""
        return {
            "projects": self.projects,
            "experience": self.experience,
            "contact": self.contact,
            "skills": self.skills_groups(),
            "profile": {
                "about": self.profile_sections.get("About Bhavya", ""),
                "education": self.profile_sections.get("Education", ""),
                "philosophy": self.profile_sections.get("Engineering Philosophy", ""),
                "interests": self.profile_sections.get("Current Interests", ""),
            },
            "riddles": [{"id": r["id"], "question": r["question"], "hint": r["hint"]} for r in self.riddles],
        }


def _split_sections(md: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current = None
    for line in md.splitlines():
        if line.startswith("# "):
            current = line[2:].strip()
            sections[current] = ""
        elif current:
            sections[current] += line + "\n"
    return {k: v.strip() for k, v in sections.items()}


@lru_cache
def get_content() -> Content:
    d = get_settings().content_dir
    files = ["persona.md", "profile.md", "projects.json", "experience.json", "contact.json", "riddles.json"]
    raw = {f: (d / f).read_text(encoding="utf-8") for f in files}
    digest = hashlib.sha256("".join(raw[f] for f in files).encode()).hexdigest()[:16]
    profile_md = raw["profile.md"]
    return Content(
        persona=raw["persona.md"],
        profile_md=profile_md,
        projects=json.loads(raw["projects.json"]),
        experience=json.loads(raw["experience.json"]),
        contact=json.loads(raw["contact.json"]),
        riddles=json.loads(raw["riddles.json"]),
        digest=digest,
        profile_sections=_split_sections(profile_md),
    )
