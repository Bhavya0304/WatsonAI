from .groq import GROQChat


class Chat(GROQChat):
    def __init__(self, API_KEY=None, model="llama-3.3-70b-versatile", temperature=0.7, max_tokens=2048):
        super().__init__(API_KEY)
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
    
    def invoke(self, messages):
        response = self.chat(messages, model=self.model, temperature=self.temperature, max_tokens=self.max_tokens)
        if( response.get('err_msg') != None):
            return response['err_msg']
        else:
            return response['choices'][0]['message']['content']

