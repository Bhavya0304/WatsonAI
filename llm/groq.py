import os
import requests

class GROQChat():

    def __init__(self,API_KEY=None):
        self.API_KEY = API_KEY or os.environ.get("GROQ_API_KEY")
        if(self.API_KEY == None):
            raise ValueError("API Key is Null")
        

    def chat(self, messages, model="llama-3.3-70b-versatile", temperature=0.7, max_tokens=2048):        

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.API_KEY}"
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_completion_tokens": max_tokens
        }
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            return {'err_msg':"Sorry, I am Exhausted for now, Can we Talk again later?"}
        else:
            raise Exception(f"Request failed with status code {response.status_code}: {response.text}")
        
