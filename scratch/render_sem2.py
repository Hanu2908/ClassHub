import fitz  # PyMuPDF
import os

pdf_path = "e:/HIMANSHU/1ST_YEAR_Project/2 SEM result.pdf"
output_path = "scratch/page_0_sem2.png"

print(f"Opening PDF: {pdf_path}")
doc = fitz.open(pdf_path)
page = doc[0]

# Render page at 2.0x zoom for high-res OCR
zoom = 2.0
mat = fitz.Matrix(zoom, zoom)
pix = page.get_pixmap(matrix=mat)
pix.save(output_path)
print(f"Rendered page 0 to {output_path} successfully!")
