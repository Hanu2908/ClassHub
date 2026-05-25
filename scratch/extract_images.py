import pypdf
import os

reader = pypdf.PdfReader("scratch/1_SEM_result.pdf")
page = reader.pages[0]

print("Images found on page 0:", len(page.images))
for i, image_file_object in enumerate(page.images):
    name = f"scratch/extracted_img_{i}.png"
    with open(name, "wb") as fp:
        fp.write(image_file_object.data)
    print(f"Saved {name}")
