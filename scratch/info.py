import pypdf

reader = pypdf.PdfReader("scratch/1_SEM_result.pdf")
print("Num pages:", len(reader.pages))
for i, page in enumerate(reader.pages):
    print(f"Page {i} images:", len(page.images))
    text = page.extract_text()
    print(f"Page {i} text length:", len(text))
    print(f"Page {i} raw text (first 200 chars):", repr(text[:200]))
