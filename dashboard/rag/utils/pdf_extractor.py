import os
import PyPDF2
from django.conf import settings

class LawExtractor:
    def __init__(self, knowledge_base_path):
        self.kb_path = knowledge_base_path

    def extract_text_from_pdfs(self):
        """Extracts text from all PDFs in the knowledge base folder."""
        documents = []
        for filename in os.listdir(self.kb_path):
            if filename.endswith('.pdf'):
                filepath = os.path.join(self.kb_path, filename)
                text = ""
                try:
                    with open(filepath, 'rb') as f:
                        reader = PyPDF2.PdfReader(f)
                        for page in reader.pages:
                            text += page.extract_text()
                    documents.append({
                        'source': filename,
                        'content': text
                    })
                    print(f"Successfully extracted: {filename}")
                except Exception as e:
                    print(f"Error reading {filename}: {e}")
        return documents

# Usage for later
# extractor = LawExtractor('g:/attempt2/attempt/dashboard/rag/knowledge_base')
