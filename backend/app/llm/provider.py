"""One OpenAI-SDK client for every provider: OpenAI, Gemini and Groq all speak the
OpenAI chat-completions protocol, so only base_url, key and model differ."""

import time
from dataclasses import dataclass, field

import openai
from openai import OpenAI

from ..config import get_settings

BASE_URLS = {
    "openai": None,
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "groq": "https://api.groq.com/openai/v1",
}


class ProviderError(Exception):
    """kind: quota (prepaid credit gone) | rate_limit | daily_limit | auth | transient"""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind


@dataclass
class Completion:
    text: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int


@dataclass
class Provider:
    name: str
    api_key: str | None
    model: str
    extra: dict = field(default_factory=dict)
    _client: OpenAI | None = None

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            s = get_settings()
            self._client = OpenAI(
                api_key=self.api_key, base_url=BASE_URLS[self.name],
                timeout=s.llm_timeout_s, max_retries=0,
            )
        return self._client

    def chat(self, messages: list[dict]) -> Completion:
        s = get_settings()
        started = time.perf_counter()
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=s.llm_temperature,
                max_tokens=s.llm_max_tokens,
                response_format={"type": "json_object"},
                **self.extra,
            )
        except openai.RateLimitError as ex:
            text = str(ex)
            if "insufficient_quota" in text:
                raise ProviderError("quota", text) from ex
            if "PerDay" in text or "per day" in text.lower():
                raise ProviderError("daily_limit", text) from ex
            raise ProviderError("rate_limit", text) from ex
        except (openai.AuthenticationError, openai.PermissionDeniedError) as ex:
            raise ProviderError("auth", str(ex)) from ex
        except openai.OpenAIError as ex:
            raise ProviderError("transient", str(ex)) from ex

        latency = int((time.perf_counter() - started) * 1000)
        text = (resp.choices[0].message.content or "").strip() if resp.choices else ""
        if not text:
            raise ProviderError("transient", "empty completion")
        usage = resp.usage
        return Completion(
            text=text,
            prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
            latency_ms=latency,
        )


def build_providers() -> list[Provider]:
    s = get_settings()
    return [
        Provider("openai", s.openai_api_key, s.openai_model),
        # Gemini 2.5 Flash "thinks" by default and that eats max_tokens; turn it off for chat.
        Provider("gemini", s.gemini_api_key, s.gemini_model, extra={"reasoning_effort": "none"}),
        Provider("groq", s.groq_api_key, s.groq_model),
    ]
