import pypdf
import os

pdf_path = "e:/HIMANSHU/1ST_YEAR_Project/2 SEM result.pdf"
txt_path = "scratch/2_SEM_result.txt"

print(f"Reading PDF: {pdf_path}")
reader = pypdf.PdfReader(pdf_path)
text = ""
for i, page in enumerate(reader.pages):
    page_text = page.extract_text()
    if page_text:
        text += page_text + "\n"
    print(f"Page {i}: extracted {len(page_text) if page_text else 0} characters")

with open(txt_path, "w", encoding="utf-8") as f:
    f.write(text)

print(f"Successfully extracted PDF text to {txt_path}!")
print(f"Total characters: {len(text)}")
print(f"Images found on page 0: {len(reader.pages[0].images)}")
