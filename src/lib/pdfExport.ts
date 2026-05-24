import html2canvas from 'html2canvas';

/**
 * Captures the element with the given ID and downloads it as a PNG.
 */
export async function exportGPAReport(elementId: string, filename = 'ClassHub-GPA-Report.png'): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error('[exportGPAReport] element not found:', elementId);
    return;
  }

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#0A0C14',
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/**
 * Encodes current GPA state as base64 JSON in the URL hash and copies to clipboard.
 */
export function generateShareURL(state: Record<string, unknown>): void {
  const encoded = btoa(encodeURIComponent(JSON.stringify(state)));
  const url = `${window.location.origin}/app/gpa#state=${encoded}`;
  navigator.clipboard.writeText(url).catch(console.error);
}

/**
 * Reads and decodes a previously shared GPA state from the URL hash.
 * Returns null if no valid state is found.
 */
export function readShareURL(): Record<string, unknown> | null {
  try {
    const hash = window.location.hash;
    const match = hash.match(/state=([^&]+)/);
    if (!match) return null;
    return JSON.parse(decodeURIComponent(atob(match[1])));
  } catch {
    return null;
  }
}
