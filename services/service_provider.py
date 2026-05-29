from helpers.reader import Reader
from services.chatservice import ChatService


_system_prompt = Reader().Read("system_prompt")

chat_service = ChatService(
    system_prompt=_system_prompt
)