"""Admin-side editing of content/: validate → back up the old file → write → reload → re-embed."""

import json
import re
import shutil
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from . import db
from .config import get_settings
from .content import get_content
from .logging_setup import log_event
from .rag.index import ensure_index

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _clean_list(items: list[str]) -> list[str]:
    return [s.strip() for s in items if s and s.strip()]


class Link(BaseModel):
    label: str = Field(min_length=1, max_length=40)
    url: str = Field(min_length=4, max_length=300)

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        if not re.match(r"^(https?://|mailto:)", v.strip()):
            raise ValueError("must start with http://, https:// or mailto:")
        return v.strip()


class Project(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=80)
    emoji: str = Field(default="✨", max_length=8)
    tagline: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=3000)
    highlights: list[str] = []
    tech: list[str] = []
    skills: list[str] = []
    status: str = Field(default="Built", max_length=30)
    links: list[Link] = []

    @field_validator("id")
    @classmethod
    def _slug(cls, v: str) -> str:
        if not SLUG.match(v):
            raise ValueError("id must be lowercase letters/numbers with dashes, e.g. friday-ivr")
        return v

    @field_validator("highlights", "tech", "skills")
    @classmethod
    def _lists(cls, v: list[str]) -> list[str]:
        return _clean_list(v)


class Experience(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=80)
    company: str = Field(min_length=1, max_length=80)
    location: str = Field(default="", max_length=80)
    start: str = Field(min_length=1, max_length=20)
    end: str = Field(default="Present", max_length=20)
    company_blurb: str = Field(default="", max_length=1500)
    summary: str = Field(min_length=1, max_length=1500)
    highlights: list[str] = []
    tech: list[str] = []

    @field_validator("id")
    @classmethod
    def _slug(cls, v: str) -> str:
        if not SLUG.match(v):
            raise ValueError("id must be lowercase letters/numbers with dashes, e.g. veripark")
        return v

    @field_validator("highlights", "tech")
    @classmethod
    def _lists(cls, v: list[str]) -> list[str]:
        return _clean_list(v)


class Contact(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    headline: str = Field(min_length=1, max_length=160)
    location: str = Field(default="", max_length=80)
    current: str = Field(default="", max_length=120)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    links: list[Link] = []


class Riddle(BaseModel):
    id: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question: str = Field(min_length=5, max_length=400)
    answer: str = Field(min_length=1, max_length=80)
    aliases: list[str] = []
    hint: str = Field(default="", max_length=200)

    @field_validator("aliases")
    @classmethod
    def _aliases(cls, v: list[str]) -> list[str]:
        return [a.lower() for a in _clean_list(v)]

    @model_validator(mode="after")
    def _answer_alias(self):
        if self.answer.lower() not in self.aliases:
            self.aliases.insert(0, self.answer.lower())
        return self


class ProfileSection(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        if "\n" in v or v.strip().startswith("#"):
            raise ValueError("title must be a single line without '#'")
        return v.strip()


def _unique_ids(items: list[BaseModel], label: str) -> None:
    ids = [i.id for i in items]  # type: ignore[attr-defined]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise ValueError(f"duplicate {label} id(s): {', '.join(sorted(dupes))}")


# section name → (file, how to validate + serialise the payload)
def _projects(data: Any) -> str:
    items = [Project.model_validate(x) for x in data]
    _unique_ids(items, "project")
    if not items:
        raise ValueError("at least one project is required")
    return json.dumps([i.model_dump() for i in items], ensure_ascii=False, indent=2) + "\n"


def _experience(data: Any) -> str:
    items = [Experience.model_validate(x) for x in data]
    _unique_ids(items, "experience")
    return json.dumps([i.model_dump() for i in items], ensure_ascii=False, indent=2) + "\n"


def _contact(data: Any) -> str:
    return json.dumps(Contact.model_validate(data).model_dump(), ensure_ascii=False, indent=2) + "\n"


def _riddles(data: Any) -> str:
    items = [Riddle.model_validate(x) for x in data]
    _unique_ids(items, "riddle")
    if not items:
        raise ValueError("at least one riddle is required")
    return json.dumps([i.model_dump() for i in items], ensure_ascii=False, indent=2) + "\n"


def _profile(data: Any) -> str:
    sections = [ProfileSection.model_validate(x) for x in data]
    if not sections:
        raise ValueError("profile needs at least one section")
    return "\n\n".join(f"# {s.title}\n{s.body.strip()}" for s in sections) + "\n"


def _persona(data: Any) -> str:
    text = str(data or "").strip()
    if len(text) < 200:
        raise ValueError("persona looks too short; it must contain Watson's rules and the JSON output format")
    if '"reply"' not in text or '"suggestions"' not in text:
        raise ValueError('persona must keep the JSON output contract ("reply", "cards", "suggestions", …)')
    return text + "\n"


SECTIONS = {
    "profile": ("profile.md", _profile),
    "projects": ("projects.json", _projects),
    "experience": ("experience.json", _experience),
    "contact": ("contact.json", _contact),
    "riddles": ("riddles.json", _riddles),
    "persona": ("persona.md", _persona),
}


def editable_payload() -> dict:
    """Everything the admin editor needs (including riddle answers)."""
    c = get_content()
    return {
        "profile": [{"title": k, "body": v} for k, v in c.profile_sections.items()],
        "projects": c.projects,
        "experience": c.experience,
        "contact": c.contact,
        "riddles": c.riddles,
        "persona": c.persona,
    }


def save_section(section: str, data: Any) -> dict:
    if section not in SECTIONS:
        raise KeyError(section)
    filename, serialise = SECTIONS[section]
    text = serialise(data)  # raises ValueError / ValidationError on bad input

    s = get_settings()
    path = s.content_dir / filename
    backup_dir = s.data_dir / "content_backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    if path.exists():
        shutil.copy2(path, backup_dir / f"{db.utcnow():%Y%m%d-%H%M%S}-{filename}")
        # keep the 50 most recent backups per file
        olds = sorted(backup_dir.glob(f"*-{filename}"))[:-50]
        for o in olds:
            o.unlink(missing_ok=True)

    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)

    get_content.cache_clear()
    try:
        get_content()
    except Exception:
        # Never leave the site broken: restore the previous file if the new one won't load.
        latest = sorted(backup_dir.glob(f"*-{filename}"))
        if latest:
            shutil.copy2(latest[-1], path)
        get_content.cache_clear()
        raise
    status = ensure_index()
    log_event("content", "content section saved", section=section, chunks=status["chunks"])
    return status
