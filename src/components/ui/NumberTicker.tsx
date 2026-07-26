import { useEffect, useRef } from 'react';

interface NumberTickerProps {
  value: number;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}

export function NumberTicker({
  value,
  decimalPlaces = 0,
  prefix = '',
  suffix = '',
  className = '',
  duration = 0.8,
}: NumberTickerProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef<number>(0);

  const targetValue = typeof value === 'number' && !isNaN(value) ? value : 0;

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const startVal = prevValueRef.current;
    const endVal = targetValue;

    if (Math.abs(startVal - endVal) < 0.01) {
      el.textContent = `${prefix}${endVal.toFixed(decimalPlaces)}${suffix}`;
      return;
    }

    let startTimestamp: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = (timestamp - startTimestamp) / (duration * 1000);
      const progress = Math.min(elapsed, 1);
      // Smooth cubic ease-out
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * easeOut;

      el.textContent = `${prefix}${current.toFixed(decimalPlaces)}${suffix}`;

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        prevValueRef.current = endVal;
        el.textContent = `${prefix}${endVal.toFixed(decimalPlaces)}${suffix}`;
      }
    };

    animId = requestAnimationFrame(step);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [targetValue, decimalPlaces, prefix, suffix, duration]);

  const initialText = `${prefix}${targetValue.toFixed(decimalPlaces)}${suffix}`;

  return (
    <span ref={spanRef} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {initialText}
    </span>
  );
}

export default NumberTicker;
