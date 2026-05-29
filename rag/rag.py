from helpers.reader import Reader

class Rag():

    def __init__(self):
        self.context = ""
        self.PreLoad()

    def PreLoad(self):
        reader = Reader()
        self.context += reader.Read("profile")
        self.context += reader.Read("experience")
        self.context += reader.Read("projects")
        self.context += reader.Read("contact")

    def GetContext(self,user_msg=None): 
        return self.context