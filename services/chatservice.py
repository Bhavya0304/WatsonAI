from llm.chat import Chat
from rag.rag import Rag
from memory.messages import ConversationHistory


class ChatService:

    def __init__(self, system_prompt: str):
        self.chat = Chat()
        self.rag = Rag()
        self.system_prompt = system_prompt

        # session_id -> history
        self.sessions = {}

    def get_history(self, session_id: str):

        if session_id not in self.sessions:
            self.sessions[session_id] = ConversationHistory(
                system_prompt=self.system_prompt
            )

        return self.sessions[session_id]

    def send_message(
        self,
        session_id: str,
        user_message: str
    ):

        history = self.get_history(session_id)

        context = self.rag.GetContext(user_message)

        history.set_context(context)

        history.add_user(user_message)

        response = self.chat.invoke(
            history.to_list()
        )

        history.add_assistant(response)

        return response