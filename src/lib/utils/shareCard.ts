import { toast } from 'sonner';

export async function shareAnnouncementCard(
  announcement: { title: string },
  portalRef: React.RefObject<HTMLDivElement | null>,
  onStartCapture: () => void,
  onEndCapture: () => void
) {
  if (!portalRef.current) {
    toast.error('Failed to prepare sharing portal');
    return;
  }

  onStartCapture();

  try {
    // 1. Dynamic import of html2canvas for optimal initial bundle sizes
    const html2canvas = (await import('html2canvas')).default;

    // 2. Perform the DOM capture
    const canvas = await html2canvas(portalRef.current, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: 'rgba(0, 0, 0, 0)', // Preserves glassmorphism corner radius
      scale: 2, // High-density rendering for sharp sharing
    });

    // 3. Convert canvas to PNG Blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error('Failed to generate image');
        onEndCapture();
        return;
      }

      const cleanTitle = announcement.title.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${cleanTitle}_Notice.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      // 4. Web Share API Execution
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: announcement.title,
          });
        } catch (err) {
          // If the user cancelled/aborted, do nothing. For other errors, download.
          if (err instanceof Error && err.name !== 'AbortError') {
            triggerDownload(blob, filename);
          }
        }
      } else {
        // Fallback: Direct download
        triggerDownload(blob, filename);
      }
      onEndCapture();
    }, 'image/png');

  } catch (error) {
    console.error('[ShareCard] Capture error:', error);
    toast.error('Failed to share notice');
    onEndCapture();
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Notice downloaded as image ✓');
}
