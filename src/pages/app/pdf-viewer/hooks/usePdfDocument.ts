import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { PageLayout } from '../types';

interface UsePdfDocumentOptions {
  rawUrl: string;
  storagePath: string;
  scriptLoaded: boolean;
}

export function usePdfDocument({ rawUrl, storagePath, scriptLoaded }: UsePdfDocumentOptions) {
  const [activeUrl, setActiveUrl] = useState<string>(rawUrl);
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [pageLayouts, setPageLayouts] = useState<PageLayout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchFreshSignedUrl = useCallback(async (path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(path, 3600);

      if (error || !data?.signedUrl) {
        console.error('[PDFViewer] createSignedUrl failed:', error);
        return null;
      }
      setActiveUrl(data.signedUrl);
      return data.signedUrl;
    } catch (err) {
      console.error('[PDFViewer] Error resolving signed URL:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!scriptLoaded || (!storagePath && !rawUrl)) return;

    let active = true;

    const loadPDFAndLayouts = async () => {
      setLoading(true);
      setLoadError(null);

      let targetUrl = activeUrl || rawUrl;
      if (!targetUrl && storagePath) {
        const resolved = await fetchFreshSignedUrl(storagePath);
        if (!active) return;
        if (!resolved) {
          setLoadError('Failed to generate document access link. Please try again.');
          setLoading(false);
          return;
        }
        targetUrl = resolved;
      }

      const tryLoad = async (docUrl: string) => {
        const task = window.pdfjsLib.getDocument({
          url: docUrl,
          withCredentials: false,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
          enableXfa: true,
        });
        return await task.promise;
      };

      try {
        let pdfDoc: any;
        try {
          pdfDoc = await tryLoad(targetUrl);
        } catch (initialErr: any) {
          // If initial load fails (e.g. token expired) and storagePath is known, refresh and retry once
          if (storagePath) {
            const refreshed = await fetchFreshSignedUrl(storagePath);
            if (!active) return;
            if (refreshed) {
              pdfDoc = await tryLoad(refreshed);
            } else {
              throw initialErr;
            }
          } else {
            throw initialErr;
          }
        }

        if (!active) return;

        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);

        // Parallel batch metadata collection (batches of 5 for speed)
        const layouts: PageLayout[] = [];
        let accumulatedOffset = 0;
        const spacing = 16;
        const total = pdfDoc.numPages;
        const batchSize = 5;

        for (let i = 1; i <= total; i += batchSize) {
          const batchIndices = Array.from(
            { length: Math.min(batchSize, total - i + 1) },
            (_, idx) => i + idx
          );

          const batchPages = await Promise.all(
            batchIndices.map((pageNum) => pdfDoc.getPage(pageNum))
          );

          for (let b = 0; b < batchPages.length; b++) {
            const page = batchPages[b];
            const pageNum = batchIndices[b];
            const baseViewport = page.getViewport({ scale: 1.0 });
            const pageWidth = baseViewport?.width || 595;
            const pageHeight = baseViewport?.height || 842;

            layouts.push({
              pageNumber: pageNum,
              width: pageWidth,
              height: pageHeight,
              offsetTop: accumulatedOffset,
            });

            accumulatedOffset += pageHeight + spacing;
          }
        }

        if (!active) return;

        setPageLayouts(layouts);
        setLoading(false);
      } catch (err) {
        console.error('[PDFViewer] Error loading document:', err);
        if (active) {
          const errMsg =
            err instanceof Error
              ? err.message
              : 'Error loading PDF document. The link may have expired.';
          setLoadError(errMsg);
          setLoading(false);
        }
      }
    };

    loadPDFAndLayouts();

    return () => {
      active = false;
    };
  }, [scriptLoaded, storagePath, rawUrl, fetchFreshSignedUrl]);

  return {
    pdf,
    numPages,
    pageLayouts,
    loading,
    loadError,
    activeUrl,
    fetchFreshSignedUrl,
  };
}
