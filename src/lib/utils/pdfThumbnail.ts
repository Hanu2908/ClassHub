/**
 * Helper to ensure PDF.js library is loaded globally
 */
export async function ensurePdfJsLoaded(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if (window.pdfjsLib) return window.pdfjsLib;

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="pdf.min.js"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          resolve(null);
        }
      });
      // In case it already loaded between check and querySelector
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        return resolve(window.pdfjsLib);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/**
 * Helper to render page 1 of a PDF file or URL onto an HTMLCanvasElement
 */
export async function renderPDFThumbnail(
  source: string | ArrayBuffer,
  canvas: HTMLCanvasElement,
  targetWidth = 180
): Promise<boolean> {
  const pdfjs = await ensurePdfJsLoaded();
  if (!pdfjs) return false;

  try {
    const loadingTask = pdfjs.getDocument(source);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    
    const originalViewport = page.getViewport({ scale: 1.0 });
    const scale = targetWidth / originalViewport.width;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    return true;
  } catch (error) {
    console.warn('[pdfThumbnail] Failed to generate PDF thumbnail:', error);
    return false;
  }
}
