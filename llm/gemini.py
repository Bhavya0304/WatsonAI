import os
from openai import OpenAI



class GeminiChat:

    DEAFULT_MODEL="gemini-2.5-flash"

    def __init__(self, API_KEY=None):
        self.API_KEY = API_KEY or os.environ.get("GEMINI_API_KEY")

        if self.API_KEY is None:
            raise ValueError("API Key is Null")

        self.client = OpenAI(
            api_key=self.API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )

    def chat(
        self,
        messages,
        model="gemini-2.5-flash",
        temperature=0.7,
        max_tokens=2048
    ):

        try:
            print(model)
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )

            return response.model_dump()

        except Exception as ex:

            error = str(ex).lower()

            if "429" in error:
                return {
                    "err_msg": "Sorry, I am Exhausted for now, Can we Talk again later?"
                }

            raise ex