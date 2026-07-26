import { useEffect, useRef } from 'react';

interface DotFieldProps {
  dotRadius?: number;
  dotSpacing?: number;
  bulgeStrength?: number;
  glowRadius?: number;
  sparkle?: boolean;
  waveAmplitude?: number;
  cursorRadius?: number;
  cursorForce?: number;
  bulgeOnly?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  glowColor?: string;
  className?: string;
}

export function DotField({
  dotRadius = 1.5,
  dotSpacing = 14,
  bulgeStrength = 67,
  glowRadius = 160,
  cursorRadius = 500,
  cursorForce = 0.1,
  gradientFrom = '#A855F7',
  gradientTo = '#B497CF',
  glowColor = '#120F17',
  className = '',
}: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;

    const updateSize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handlePointerLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerleave', handlePointerLeave);

    const render = () => {
      ctx.fillStyle = glowColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cols = Math.ceil(canvas.width / dotSpacing) + 1;
      const rows = Math.ceil(canvas.height / dotSpacing) + 1;

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, gradientFrom);
      gradient.addColorStop(1, gradientTo);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const baseX = i * dotSpacing;
          const baseY = j * dotSpacing;

          let drawX = baseX;
          let drawY = baseY;
          let alpha = 0.35;
          let currentRadius = dotRadius;

          if (mouseRef.current.active) {
            const dx = mouseRef.current.x - baseX;
            const dy = mouseRef.current.y - baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < cursorRadius && dist > 0) {
              const factor = (1 - dist / cursorRadius);
              const push = factor * bulgeStrength * cursorForce;
              drawX = baseX - (dx / dist) * push;
              drawY = baseY - (dy / dist) * push;

              if (dist < glowRadius) {
                const glowFactor = 1 - dist / glowRadius;
                alpha = 0.35 + glowFactor * 0.55;
                currentRadius = dotRadius + glowFactor * 1.2;
              }
            }
          }

          ctx.fillStyle = gradient;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(drawX, drawY, currentRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
    };
  }, [dotRadius, dotSpacing, bulgeStrength, glowRadius, cursorRadius, cursorForce, gradientFrom, gradientTo, glowColor]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

export default DotField;
