import { createWorker } from 'tesseract.js';
import fs from 'fs';

async function main() {
  const worker = await createWorker('eng');
  
  console.log('Worker initialized. Starting OCR on scratch/page_0_sem2.png...');
  if (fs.existsSync('scratch/page_0_sem2.png')) {
    const { data: { text } } = await worker.recognize('scratch/page_0_sem2.png');
    fs.writeFileSync('scratch/page_0_sem2_ocr.txt', text);
    console.log('OCR completed! Text written to scratch/page_0_sem2_ocr.txt');
  } else {
    console.error('scratch/page_0_sem2.png does not exist!');
  }

  await worker.terminate();
}

main().catch(err => {
  console.error(err);
});
