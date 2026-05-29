import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Lock, Unlock, RefreshCw, X, Sparkles } from 'lucide-react';
import type { Worker as TesseractWorker } from 'tesseract.js';
import { useGPAStore } from '../../../store/gpaStore';
import {
  GRADE_SCALE,
  marksToGrade,
  marksToColor,
  marksToPoint,
  computeSGPA,
} from '../../../lib/gpaData';
import { showToast } from '../../../components/Toast';

const T = {
  card:      'rgba(18,20,32,0.7)',
  cardBdr:   'rgba(255,255,255,0.07)',
  topBdr:    'rgba(255,255,255,0.1)',
  label:     '#6B7280',
  body:      '#9CA3AF',
  heading:   '#E5E7EB',
  cgpa:      '#7C9EF8',
  grid:      'rgba(255,255,255,0.045)',
  accent:    '#5B7CF7',
};

const N = {
  border:    T.cardBdr,
  text:      T.body,
  textPri:   T.heading,
};

function useAnimatedNumber(target: number, duration = 400): number {
  const [v, setV] = useState(target);
  const raf = useRef<number | null>(null);
  const t0  = useRef(0);
  const fr  = useRef(target);
  useEffect(() => {
    const from = fr.current;
    if (Math.abs(target - from) < 0.001) return;
    t0.current = performance.now();
    const run = (now: number) => {
      const p = Math.min((now - t0.current) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(parseFloat((from + (target - from) * e).toFixed(3)));
      if (p < 1) { raf.current = requestAnimationFrame(run); }
      else { fr.current = target; }
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(run);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return v;
}

function GradeBadge({ marks }: { marks: number | null }) {
  if (marks === null) return (
    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: N.text, padding: '3px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, whiteSpace: 'nowrap' }}>—</span>
  );
  const g = marksToGrade(marks);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: g.color, padding: '3px 8px', background: `${g.color}18`, border: `1px solid ${g.color}44`, borderRadius: 6, whiteSpace: 'nowrap', transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: g.color, flexShrink: 0, boxShadow: `0 0 4px ${g.color}` }} />
      {g.label}
    </span>
  );
}

function MarksTrack({ marks }: { marks: number | null }) {
  const pct = marks !== null ? marks : 0;
  const color = marksToColor(marks);
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: marks !== null ? `0 0 6px ${color}88` : 'none' }} />
    </div>
  );
}

function MarksInput({
  value, onChange, disabled, subjectName, subjectIndex,
}: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean; subjectName: string; subjectIndex: number }) {
  const [raw, setRaw] = useState<string>(value !== null ? String(value) : '');
  const [isFocused, setIsFocused] = useState(false);
  const [prevValue, setPrevValue] = useState(value);
  const color = value !== null ? marksToColor(value) : 'rgba(255,255,255,0.3)';

  if (value !== prevValue) {
    setRaw(value !== null ? String(value) : '');
    setPrevValue(value);
  }

  const commit = () => {
    const n = parseFloat(raw);
    if (raw === '' || raw === '-') onChange(null);
    else if (!isNaN(n) && n >= 0 && n <= 100) onChange(Math.round(n * 100) / 100);
    else setRaw(value !== null ? String(value) : '');
  };

  return (
    <input
      type="number" min={0} max={100} step={1}
      value={raw} disabled={disabled}
      name={`subject-marks-${subjectIndex}`}
      autoComplete="off"
      aria-label={`Marks for ${subjectName || `subject ${subjectIndex + 1}`}`}
      onChange={e => setRaw(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        commit();
      }}
      onKeyDown={e => e.key === 'Enter' && commit()}
      placeholder="—"
      style={{
        padding: '5px 6px', borderRadius: 7, width: '100%',
        background: value !== null ? `${color}10` : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${isFocused ? T.accent : (value !== null ? color + '55' : 'rgba(255,255,255,0.07)')}`,
        boxShadow: isFocused ? `0 0 0 2px ${T.accent}22` : 'none',
        outline: 'none', color: value !== null ? color : 'rgba(255,255,255,0.25)',
        fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700,
        textAlign: 'center', transition: 'all 0.2s',
      }}
    />
  );
}

function GradeScaleBar() {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBdr}`, borderTop: `1px solid ${T.topBdr}`,
      borderRadius: 'var(--radius-lg)', padding: '12px 14px',
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, color: T.label, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        Marks → Grade · SKIT Autonomous
      </p>
      <div style={{ height: 5, borderRadius: 99, background: `linear-gradient(90deg, #F87171 0%, #F97316 15%, #FCD34D 28%, #34D399 40%, #67E8F9 52%, #60A5FA 65%, #818CF8 80%, #4ADE80 100%)`, marginBottom: 8, opacity: 0.8 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {GRADE_SCALE.slice().reverse().map(g => (
          <div key={g.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.body, fontFamily: 'var(--font-mono)' }}>{g.label}</span>
            <span style={{ fontSize: 8, color: T.label, fontFamily: 'var(--font-mono)' }}>
              {g.label === 'O' ? '90+' : g.label === 'F' ? '<40' : `${g.minMark}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GlassCard({ children, style: sx }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBdr}`,
      borderTop: `1.5px solid ${T.topBdr}`,
      borderRadius: 'var(--radius-lg)', padding: 16,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      ...sx,
    }}>
      {children}
    </div>
  );
}

function RowSubjectNameInput({ value, onChange, disabled, idx }: { value: string; onChange: (v: string) => void; disabled: boolean; idx: number }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <input
      name={`subject-name-${idx}`}
      autoComplete="off"
      aria-label={`Subject name ${idx + 1}`}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      placeholder="Subject name…"
      style={{
        background: isFocused ? 'rgba(0,0,0,0.2)' : 'transparent',
        border: isFocused ? `1px solid ${T.accent}` : '1px solid transparent',
        boxShadow: isFocused ? `0 0 0 2px ${T.accent}22` : 'none',
        borderRadius: 6,
        outline: 'none',
        color: 'var(--text-primary)',
        fontSize: 12,
        fontFamily: 'var(--font-body)',
        width: '100%',
        padding: '3px 6px',
        transition: 'all 0.2s'
      }}
    />
  );
}

function RowCreditsInput({ value, onChange, disabled, idx, subName }: { value: number; onChange: (v: number) => void; disabled: boolean; idx: number; subName: string }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <input
      type="number"
      min={1}
      max={6}
      value={value}
      disabled={disabled}
      name={`subject-credits-${idx}`}
      autoComplete="off"
      onChange={e => onChange(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      aria-label={`Credits for ${subName || `subject ${idx + 1}`}`}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: isFocused ? `1.5px solid ${T.accent}` : `1px solid ${N.border}`,
        boxShadow: isFocused ? `0 0 0 2px ${T.accent}22` : 'none',
        borderRadius: 6,
        outline: 'none',
        color: 'var(--text-primary)',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        textAlign: 'center',
        padding: '4px 2px',
        width: '100%',
        transition: 'all 0.2s'
      }}
    />
  );
}

interface CalculatorTabProps {
  sem: number;
}

export default function CalculatorTab({ sem }: CalculatorTabProps) {
  const { semesters, addSubject, updateSubject, removeSubject, resetSemester, lockSemester } = useGPAStore();
  const { subjects = [], locked = false } = semesters[sem] ?? {};
  
  const sgpa         = useMemo(() => computeSGPA(subjects), [subjects]);
  const totalCredits = useMemo(() => subjects.filter(s => s.marks !== null).reduce((a, s) => a + s.credits, 0), [subjects]);
  const animSGPA     = useAnimatedNumber(sgpa);
  
  const avgMarks     = useMemo(() => {
    const e = subjects.filter(s => s.marks !== null);
    return e.length ? e.reduce((a, s) => a + (s.marks ?? 0), 0) / e.length : 0;
  }, [subjects]);

  // OCR state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [ocrWorker, setOcrWorker] = useState<TesseractWorker | null>(null);
  const [extractedMatches, setExtractedMatches] = useState<Array<{ id: string; name: string; marks: number; grade: string }>>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // References for keyboard a11y focus traps
  const scanTriggerRef = useRef<HTMLLabelElement>(null);
  const reviewModalRef = useRef<HTMLDivElement>(null);

  // Terminate Tesseract worker on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (ocrWorker) {
        ocrWorker.terminate();
      }
    };
  }, [ocrWorker]);

  // Initialize Tesseract worker dynamically
  const initOcrWorker = async () => {
    if (ocrWorker) return ocrWorker;
    setScanProgress('Initializing OCR…');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      setOcrWorker(worker);
      return worker;
    } catch (err) {
      console.error('Failed to load Tesseract worker:', err);
      showToast('Could not load OCR engine', 'error');
      return null;
    }
  };

  // Initialize PDF.js dynamically
  const initPdfJs = async () => {
    if (window.pdfjsLib) return window.pdfjsLib;
    setScanProgress('Loading PDF engine…');
    return new Promise((resolve, reject) => {
      // Clean up previous script elements if any to prevent memory leaks
      const existingScript = document.getElementById('pdfjs-library-cdn');
      if (existingScript) existingScript.remove();

      const script = document.createElement('script');
      script.id = 'pdfjs-library-cdn';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.integrity = 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = () => {
        reject(new Error('Failed to load PDF engine'));
      };
      document.body.appendChild(script);
    });
  };

  // Enforce keyboard WAI-ARIA Focus Trap and Escape actions inside the OCR scanned reviews modal
  useEffect(() => {
    if (!showReviewModal) return;

    // Focus first active button (Cancel) in review modal
    const focusable = reviewModalRef.current?.querySelectorAll('button') || [];
    if (focusable.length > 0) {
      (focusable[0] as HTMLElement).focus();
    }

    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowReviewModal(false);
        scanTriggerRef.current?.focus();
      } else if (e.key === 'Tab' && reviewModalRef.current) {
        const items = reviewModalRef.current.querySelectorAll('button');
        if (items.length > 0) {
          const first = items[0] as HTMLElement;
          const last = items[items.length - 1] as HTMLElement;
          if (e.shiftKey) {
            if (document.activeElement === first) {
              last.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === last) {
              first.focus();
              e.preventDefault();
            }
          }
        }
      }
    };

    const trigger = scanTriggerRef.current;
    window.addEventListener('keydown', handleKeys);
    return () => {
      window.removeEventListener('keydown', handleKeys);
      // Restore focus to scan trigger on unmount
      trigger?.focus();
    };
  }, [showReviewModal]);

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanProgress('Starting scanner…');
    
    try {
      let text = '';
      if (file.type === 'application/pdf') {
        const pdfjs = (await initPdfJs()) as any;
        setScanProgress('Reading PDF…');
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        
        let fullText = '';
        for (let pNum = 1; pNum <= pdfDoc.numPages; pNum++) {
          setScanProgress(`Reading PDF page ${pNum}/${pdfDoc.numPages}…`);
          const page = await pdfDoc.getPage(pNum);
          const textContent = await page.getTextContent();
          const items = textContent.items;

          if (items.length === 0) {
            setScanProgress(`Rendering page ${pNum} to high-res image…`);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
              setScanProgress(`Running OCR on page ${pNum}/${pdfDoc.numPages}…`);
              const worker = await initOcrWorker();
              if (worker) {
                const { data: { text: ocrText } } = await worker.recognize(canvas);
                fullText += ocrText + '\n';
              }
            }
          } else {
            interface PDFItem {
              str: string;
              transform: number[];
            }
            const lineMap: Record<number, PDFItem[]> = {};
            
            (items as PDFItem[]).forEach((item) => {
              if (!item.str.trim()) return;
              const y = Math.round(item.transform[5]);
              const matchedY = Object.keys(lineMap).find(key => Math.abs(Number(key) - y) < 4);
              if (matchedY) {
                lineMap[Number(matchedY)].push(item);
              } else {
                lineMap[y] = [item];
              }
            });
            
            const sortedY = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
            const pageLines = sortedY.map(y => {
              const lineItems = lineMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
              return lineItems.map(item => item.str).join(' ');
            });
            
            fullText += pageLines.join('\n') + '\n';
          }
        }
        text = fullText;
      } else {
        const worker = await initOcrWorker();
        if (!worker) {
          setIsScanning(false);
          return;
        }

        setScanProgress('Processing image…');
        const imageElement = document.createElement('img');
        const previewUrl = URL.createObjectURL(file);
        
        imageElement.src = previewUrl;
        await new Promise((resolve) => {
          imageElement.onload = () => {
            // Revoke immediately to clean up memory
            URL.revokeObjectURL(previewUrl);
            resolve(null);
          };
        });

        // Downscale image to max width of 1600px maintaining original aspect ratio
        const MAX_WIDTH = 1600;
        let width = imageElement.naturalWidth || imageElement.width;
        let height = imageElement.naturalHeight || imageElement.height;
        
        if (width > MAX_WIDTH) {
          const ratio = MAX_WIDTH / width;
          width = MAX_WIDTH;
          height = Math.round(height * ratio);
        }

        const preprocessCanvas = document.createElement('canvas');
        preprocessCanvas.width = width;
        preprocessCanvas.height = height;
        const pCtx = preprocessCanvas.getContext('2d');
        if (pCtx) {
          // Draw downscaled image onto the preprocess canvas
          pCtx.drawImage(imageElement, 0, 0, width, height);
          const imgData = pCtx.getImageData(0, 0, width, height);
          const data = imgData.data;
          
          // High contrast binary thresholding
          for (let i = 0; i < data.length; i += 4) {
            const grayscale = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
            const binaryValue = grayscale > 125 ? 255 : 0;
            data[i] = binaryValue;
            data[i + 1] = binaryValue;
            data[i + 2] = binaryValue;
          }
          pCtx.putImageData(imgData, 0, 0);
        }

        setScanProgress('Analyzing text…');
        const { data: { text: ocrText } } = await worker.recognize(preprocessCanvas);
        text = ocrText;
      }
      setScanProgress('Matching subjects…');

      const matches: Array<{ id: string; name: string; marks: number; grade: string }> = [];
      const lines = text.split('\n');

      const cleanText = (str: string) => str.toUpperCase().replace(/[^A-Z0-9\-+\s]/g, ' ');

      const extractNumbers = (str: string) => {
        const words = str.split(/\s+/);
        const nums: number[] = [];
        words.forEach(w => {
          if (/^\d+$/.test(w)) {
            const val = parseInt(w, 10);
            if (val >= 0 && val <= 100) {
              nums.push(val);
            }
          }
        });
        return nums;
      };

      const getMarksFromLine = (line: string) => {
        const nums = extractNumbers(line);
        if (nums.length === 0) return null;
        
        if (nums.length >= 3) {
          const ise = nums[0];
          const see = nums[1];
          const total = nums[2];
          
          if (ise + see === total) return total;
          if (ise + see >= 40 && ise + see <= 100) {
            return ise + see;
          }
          if (total >= 30 && total <= 100) {
            return total;
          }
          return Math.max(total, ise + see);
        } else if (nums.length === 2) {
          const x = nums[0];
          const y = nums[1];
          if (y >= 30) return y;
          return x;
        } else {
          return nums[0];
        }
      };

      lines.forEach((line: string) => {
        if (!line.trim()) return;
        const cleanLine = cleanText(line);
        
        subjects.forEach(sub => {
          const cleanSub = sub.name.toUpperCase();
          let isMatch = false;
          let refinedName = sub.name;
          
          if (cleanSub.includes('SODECA') && cleanLine.includes('SODECA')) {
            isMatch = true;
            refinedName = 'SODECA';
          } else if (cleanSub.includes('THINKING') && cleanLine.includes('THINKING')) {
            isMatch = true;
            refinedName = 'Computational Thinking and Programming';
          } else if (cleanSub.includes('BASIC ELECTRICAL') && cleanLine.includes('MECHANICAL')) {
            isMatch = true;
            refinedName = 'Basic Mechanical Engineering';
          } else if (cleanSub.includes('BASIC EE LAB') && (cleanLine.includes('MANUFACTURING') || cleanLine.includes('PRACTICE'))) {
            isMatch = true;
            refinedName = 'Manufacturing Practice Workshop';
          } else {
            const options = cleanSub.split('/').map(opt => opt.trim());
            for (const option of options) {
              if (option.length < 3) continue;
              
              const keywords = option
                .replace(/[^A-Z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 2 && !['AND', 'THE', 'LAB', 'PRACTICAL', 'THEORY', 'ENGINEERING', 'BASIC', 'SKILLS', 'VALUES'].includes(w));
              
              if (keywords.length === 0) continue;
              
              const matchCount = keywords.filter(w => cleanLine.includes(w)).length;
              const required = keywords.length === 1 ? 1 : Math.min(2, keywords.length);
              
              if (matchCount >= required) {
                const optionIsLab = option.includes('LAB') || option.includes('WORKSHOP') || option.includes('PRACTICE') || option.includes('GRAPHICS');
                const lineIsLab = cleanLine.includes('LAB') || cleanLine.includes('WORKSHOP') || cleanLine.includes('PRACTICE') || cleanLine.includes('WORKS') || cleanLine.includes('UP') || cleanLine.includes('MEUP') || cleanLine.includes('CSUP') || cleanLine.includes('CHUP') || cleanLine.includes('HSUP');
                
                if (optionIsLab !== lineIsLab) {
                  continue;
                }
                
                isMatch = true;
                
                if (option.includes('CHEMISTRY') && option.includes('LAB')) {
                  refinedName = 'Engineering Chemistry Lab';
                } else if (option.includes('PHYSICS') && option.includes('LAB')) {
                  refinedName = 'Engineering Physics Lab';
                } else if (option.includes('CHEMISTRY')) {
                  refinedName = 'Engineering Chemistry';
                } else if (option.includes('PHYSICS')) {
                  refinedName = 'Engineering Physics';
                } else if (option.includes('UNIVERSAL HUMAN VALUES') && option.includes('LAB')) {
                  refinedName = 'Universal Human Values Lab';
                } else if (option.includes('LANGUAGE')) {
                  refinedName = 'Language Lab';
                } else if (option.includes('VALUES')) {
                  refinedName = 'Universal Human Values';
                } else if (option.includes('COMMUNICATION')) {
                  refinedName = 'Communication Skills';
                } else if (option.includes('MANUFACTURING') || option.includes('PRACTICE')) {
                  refinedName = 'Manufacturing Practice Workshop';
                } else {
                  refinedName = sub.name.split('/').find(opt => opt.toUpperCase().includes(option))?.trim() || sub.name;
                }
                break;
              }
            }
          }
          
          if (isMatch) {
            const foundMarks = getMarksFromLine(cleanLine);
            
            let foundGrade: string | null = null;
            const gradesRegex = /\b(O|A\+|A|B\+|B|C|P|F)\b/;
            const words = cleanLine.split(/\s+/).filter(Boolean);
            for (let i = words.length - 1; i >= 0; i--) {
              if (gradesRegex.test(words[i])) {
                foundGrade = words[i];
                break;
              }
            }
            
            if (foundMarks !== null || foundGrade !== null) {
              const gradeMap: Record<string, number> = {
                'O': 95, 'A+': 85, 'A': 75, 'B+': 65, 'B': 55, 'C': 47, 'P': 42, 'F': 30
              };
              
              const finalMarks = foundMarks ?? (foundGrade ? gradeMap[foundGrade] : 0);
              const finalGrade = foundGrade ?? marksToGrade(finalMarks).label;
              
              if (!matches.some(m => m.id === sub.id)) {
                matches.push({
                  id: sub.id,
                  name: refinedName,
                  marks: finalMarks,
                  grade: finalGrade
                });
              }
            }
          }
        });
      });

      setIsScanning(false);
      
      if (matches.length > 0) {
        setExtractedMatches(matches);
        setShowReviewModal(true);
      } else {
        showToast('Scanning finished but no subjects/grades could be matched.', 'warning');
      }

    } catch (err) {
      console.error('OCR error:', err);
      showToast('Scanning failed. Enter grades manually.', 'error');
      setIsScanning(false);
    }
  };

  const handleApplyOcr = () => {
    extractedMatches.forEach(match => {
      updateSubject(sem, match.id, { marks: match.marks, name: match.name });
    });
    setShowReviewModal(false);
    setExtractedMatches([]);
    showToast(`Successfully applied ${extractedMatches.length} subject grades!`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
      <GradeScaleBar />

      {isScanning && (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBdr}`, borderTop: `1.5px solid ${T.topBdr}`,
          borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%', background: '#FBBF24',
              width: '50%', animation: 'pulse 1.2s infinite'
            }} />
          </div>
          <span style={{ fontSize: 11, color: T.body, fontFamily: 'var(--font-mono)' }}>{scanProgress}</span>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: N.text, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          {avgMarks > 0 && <span style={{ color: marksToColor(avgMarks), marginLeft: 8 }}>· avg {avgMarks.toFixed(1)}</span>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <label 
            ref={scanTriggerRef}
            tabIndex={0}
            aria-label="Scan academic marksheet image or PDF"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                scanTriggerRef.current?.querySelector('input')?.click();
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8,
              background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)',
              color: '#FBBF24', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)',
              transition: 'all 0.15s', outline: 'none'
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px #FBBF24'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <Sparkles size={11} className={isScanning ? 'animate-pulse' : ''} />
            {isScanning ? 'Scanning…' : 'Scan Marksheet'}
            <input type="file" accept="image/*,application/pdf" onChange={handleOcrUpload} disabled={isScanning || locked} style={{ display: 'none' }} tabIndex={-1} />
          </label>

          {[
            { icon: <RefreshCw size={11} />, label: 'Reset', onClick: () => resetSemester(sem), active: false },
            { icon: locked ? <Lock size={11} /> : <Unlock size={11} />, label: locked ? 'Locked' : 'Lock', onClick: () => lockSemester(sem, !locked), active: locked },
          ].map(b => (
            <button key={b.label} onClick={b.onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: b.active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${b.active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`, color: b.active ? '#818CF8' : N.text, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s' }}>
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subject Table */}
      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 68px 48px 18px', gap: 6, padding: '9px 14px', background: 'rgba(255,255,255,0.025)', borderBottom: `1px solid ${N.border}` }}>
          {['Subject', 'Cr', 'Marks', 'Grade', ''].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 600, color: N.text, fontFamily: 'var(--font-mono)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {subjects.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: N.text, fontSize: 13 }}>No subjects. Add one below.</div>
        ) : subjects.map((sub, idx) => {
          const gp = sub.marks !== null ? marksToPoint(sub.marks) : null;
          return (
            <div key={sub.id} style={{ borderBottom: idx < subjects.length - 1 ? `1px solid ${N.border}` : 'none', background: sub.marks !== null ? `${marksToGrade(sub.marks).color}07` : 'transparent', transition: 'background 0.25s' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 68px 48px 18px', gap: 6, padding: '9px 14px', alignItems: 'center' }}>
                <div>
                  <RowSubjectNameInput
                    value={sub.name}
                    disabled={locked}
                    idx={idx}
                    onChange={v => updateSubject(sem, sub.id, { name: v })}
                  />
                  <MarksTrack marks={sub.marks} />
                </div>
                <RowCreditsInput
                  value={sub.credits}
                  disabled={locked}
                  idx={idx}
                  subName={sub.name}
                  onChange={v => updateSubject(sem, sub.id, { credits: v })}
                />
                <MarksInput value={sub.marks} onChange={v => updateSubject(sem, sub.id, { marks: v })} disabled={locked} subjectName={sub.name} subjectIndex={idx} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <GradeBadge marks={sub.marks} />
                  {gp !== null && <span style={{ fontSize: 8, color: N.text, fontFamily: 'var(--font-mono)' }}>{gp}pt</span>}
                </div>
                <button onClick={() => removeSubject(sem, sub.id)} disabled={locked}
                  aria-label={`Remove subject ${sub.name || idx + 1}`}
                  style={{ background: 'none', border: 'none', cursor: locked ? 'not-allowed' : 'pointer', color: N.text, opacity: locked ? 0.3 : 0.6, display: 'flex', alignItems: 'center', padding: 1, transition: 'opacity 0.15s' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}

        {!locked && (
          <button onClick={() => addSubject(sem)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 16px', background: 'rgba(99,102,241,0.05)', border: 'none', borderTop: `1px solid ${N.border}`, color: '#818CF8', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}>
            <Plus size={13} /> Add Subject
          </button>
        )}
      </GlassCard>

      {/* SGPA footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: T.card, border: `1px solid ${T.cardBdr}`, borderTop: `2px solid ${T.topBdr}`, borderRadius: 'var(--radius-lg)' }}>
        <div>
          <div style={{ fontSize: 9, color: T.label, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Total Credits Earned</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.heading, fontFamily: 'var(--font-display)' }}>{totalCredits}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: T.label, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>S{sem} SGPA</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: T.cgpa, fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', lineHeight: 1 }}>{animSGPA.toFixed(2)}</div>
        </div>
      </div>

      {showReviewModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          padding: 20
        }}>
          <div 
            ref={reviewModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-header"
            style={{
              background: '#161824', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <span id="review-modal-header" style={{ fontSize: 14, fontWeight: 700, color: T.heading }}>Review Scanned Grades</span>
              <button onClick={() => setShowReviewModal(false)} aria-label="Close review modal" style={{ background: 'none', border: 'none', color: T.body, cursor: 'pointer', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
              {extractedMatches.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                    <span style={{ fontSize: 10, color: T.label, fontFamily: 'var(--font-mono)' }}>Extracted: {m.marks} Marks</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: marksToGrade(m.marks).color,
                    padding: '3px 8px', background: `${marksToGrade(m.marks).color}18`,
                    border: `1px solid ${marksToGrade(m.marks).color}44`, borderRadius: 6,
                    fontFamily: 'var(--font-mono)'
                  }}>{m.grade}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: 20, background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setShowReviewModal(false)} style={{ flex: 1, padding: '10px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: T.body, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleApplyOcr} style={{ flex: 1, padding: '10px 16px', background: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>Apply Grades</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
