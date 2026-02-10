import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

class VectorStoreManager:
    def __init__(self):
        self.kb_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'knowledge_base')
        self.db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'vector_db')
        # Using a free, high-quality embedding model from HuggingFace
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    def create_vector_db(self):
        """Processes PDFs and creates a FAISS vector database."""
        all_docs = []
        
        if not os.path.exists(self.kb_path):
            print(f"Directory not found: {self.kb_path}")
            return

        for filename in os.listdir(self.kb_path):
            if filename.endswith('.pdf'):
                print(f"Processing {filename}...")
                loader = PyPDFLoader(os.path.join(self.kb_path, filename))
                all_docs.extend(loader.load())

        if not all_docs:
            print("No PDF documents found in knowledge base.")
            return

        # Split text into chunks for better retrieval
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        splits = text_splitter.split_documents(all_docs)

        # Create and save the vector store
        vectorstore = FAISS.from_documents(documents=splits, embedding=self.embeddings)
        vectorstore.save_local(self.db_path)
        print(f"Vector database created and saved to {self.db_path}")

    def load_vector_db(self):
        """Loads the existing FAISS vector database."""
        if os.path.exists(os.path.join(self.db_path, "index.faiss")):
            return FAISS.load_local(self.db_path, self.embeddings, allow_dangerous_deserialization=True)
        return None

if __name__ == "__main__":
    manager = VectorStoreManager()
    manager.create_vector_db()
