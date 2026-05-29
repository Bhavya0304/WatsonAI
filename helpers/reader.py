import os


class Reader():
    def __init__(self,path=None):
        self.path = path or "./data"
    
    def Read(self,file):

        with open(self.path + "/" + file + ".md",encoding='utf-8') as file:
            content  = file.read()
            return content