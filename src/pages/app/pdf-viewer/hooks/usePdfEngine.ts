import { useState, useEffect } from 'react';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export function usePdfEngine() {
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(() => Boolean(window.pdfjsLib));
  const [engineError, setEngineError] = useState<string | null>(null);

  useEffect(() => {
    if (window.pdfjsLib) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;

    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        setScriptLoaded(true);
      }
    };

    script.onerror = () => {
      setEngineError('Failed to load PDF engine. Please check your internet connection.');
    };

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return { scriptLoaded, engineError };
}
