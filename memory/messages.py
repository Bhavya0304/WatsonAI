from collections import deque
from typing import Literal
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str = Field(min_length=1)


class ConversationHistory:
    def __init__(
        self,
        system_prompt: str,
        max_messages: int = 40
    ):
        self._system_prompt = system_prompt
        self._context = ""
        self._messages = deque(maxlen=max_messages)

    def add(
        self,
        role: Literal["user", "assistant", "tool"],
        content: str
    ):
        self._messages.append(
            Message(
                role=role,
                content=content
            )
        )

    def add_user(self, content: str):
        self.add("user", content)

    def add_assistant(self, content: str):
        self.add("assistant", content)

    def add_tool(self, content: str):
        self.add("tool", content)

    def set_context(self, context: str):
        self._context = context

    def clear_context(self):
        self._context = ""

    def clear(self):
        self._messages.clear()

    def to_list(self) -> list[dict]:
        system_content = self._system_prompt

        if self._context:
            system_content += f"\n\nContext:\n{self._context}"

        return [
            {
                "role": "system",
                "content": system_content
            },
            *[msg.model_dump() for msg in self._messages]
        ]

    def __len__(self):
        return len(self._messages)

    def __iter__(self):
        return iter(self._messages)

    def __getitem__(self, index):
        return list(self._messages)[index]