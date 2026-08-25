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
  dotSpacing = 16,
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
  const mouseRef = useRef<{ x: number; y: number; active: boolean; lastMove: number }>({
    x: -1000,
    y: -1000,
    active: false,
    lastMove: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animFrameId: number | null = null;
    let isLoopRunning = false;
    let cachedGradient: CanvasGradient | null = null;

    const drawField = (isInteractive: boolean) => {
      ctx.fillStyle = glowColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cols = Math.ceil(canvas.width / dotSpacing) + 1;
      const rows = Math.ceil(canvas.height / dotSpacing) + 1;

      if (!cachedGradient) {
        cachedGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        cachedGradient.addColorStop(0, gradientFrom);
        cachedGradient.addColorStop(1, gradientTo);
      }

      ctx.fillStyle = cachedGradient;

      if (!isInteractive) {
        // Fast static batch render
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < cols; i++) {
          const baseX = i * dotSpacing;
          for (let j = 0; j < rows; j++) {
            const baseY = j * dotSpacing;
            ctx.beginPath();
            ctx.arc(baseX, baseY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1.0;
        return;
      }

      // Interactive render with cursor interaction
      const mouse = mouseRef.current;
      for (let i = 0; i < cols; i++) {
        const baseX = i * dotSpacing;
        for (let j = 0; j < rows; j++) {
          const baseY = j * dotSpacing;

          let drawX = baseX;
          let drawY = baseY;
          let alpha = 0.35;
          let currentRadius = dotRadius;

          if (mouse.active) {
            const dx = mouse.x - baseX;
            const dy = mouse.y - baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < cursorRadius && dist > 0) {
              const factor = 1 - dist / cursorRadius;
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

          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(drawX, drawY, currentRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
    };

    const updateSize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      cachedGradient = null;
      drawField(mouseRef.current.active);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const startAnimationLoop = () => {
      if (isLoopRunning) return;
      isLoopRunning = true;

      const loop = () => {
        const now = performance.now();
        const timeSinceMove = now - mouseRef.current.lastMove;

        drawField(mouseRef.current.active);

        // If inactive or stationary for > 400ms, settle into static state and stop RAF
        if (!mouseRef.current.active || timeSinceMove > 400) {
          isLoopRunning = false;
          animFrameId = null;
          drawField(false);
          return;
        }

        animFrameId = requestAnimationFrame(loop);
      };

      animFrameId = requestAnimationFrame(loop);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
      mouseRef.current.lastMove = performance.now();
      startAnimationLoop();
    };

    const handlePointerLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.lastMove = 0;
      if (!isLoopRunning) {
        drawField(false);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    // Initial static frame
    drawField(false);

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
