import fitz  # PyMuPDF
import os

doc = fitz.open("scratch/1_SEM_result.pdf")
print("Num pages:", len(doc))
page = doc[0]

# Render page at 2.0x zoom for high-res OCR
zoom = 2.0
mat = fitz.Matrix(zoom, zoom)
pix = page.get_pixmap(matrix=mat)
output_path = "scratch/page_0.png"
pix.save(output_path)
print(f"Rendered page 0 to {output_path} successfully!")
