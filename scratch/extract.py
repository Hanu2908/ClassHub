import os
import sys

def extract_pdf():
    try:
        import pypdf
        print("Using pypdf")
        reader = pypdf.PdfReader("scratch/1_SEM_result.pdf")
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        with open("scratch/1_SEM_result.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print("Successfully extracted PDF using pypdf")
        return True
    except ImportError:
        print("pypdf not found")
        
    try:
        import pdfplumber
        print("Using pdfplumber")
        with pdfplumber.open("scratch/1_SEM_result.pdf") as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() + "\n"
        with open("scratch/1_SEM_result.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print("Successfully extracted PDF using pdfplumber")
        return True
    except ImportError:
        print("pdfplumber not found")

    return False

if not extract_pdf():
    print("No PDF extraction libraries found. Attempting to install pypdf...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
    extract_pdf()
