import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  analyser: AnalyserNode | null;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Set actual size in memory (scaled to account for extra pixel density)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Normalize coordinate system to use css pixels
    ctx.scale(dpr, dpr);

    const renderWidth = rect.width;
    const renderHeight = rect.height;

    // Get theme color from CSS variable
    const computedStyle = getComputedStyle(document.documentElement);
    // Parse RGB from e.g. "196 242 13" or fallback
    const themeRgbString = computedStyle.getPropertyValue('--theme-rgb').trim() || '196 242 13';

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, renderWidth, renderHeight);

      if (isActive && analyser) {
        const bufferLength = analyser.frequencyBinCount; // 256 for fftSize 512
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Visual settings
        const barsToDraw = 30; // Number of bars on one side (total = barsToDraw * 2 + 1 center)
        const spacing = 4;
        const width = 6;
        const cx = renderWidth / 2;

        // Draw center bar first
        const centerValue = dataArray[0] || 0;
        const centerPercent = centerValue / 255;
        const centerH = Math.max(width, centerPercent * (renderHeight * 0.8));

        ctx.fillStyle = `rgba(${themeRgbString}, ${Math.max(0.4, centerPercent)})`;
        drawRoundedRect(ctx, cx - width / 2, (renderHeight - centerH) / 2, width, centerH, width / 2);

        // Draw symmetrical bars
        for (let i = 1; i <= barsToDraw; i++) {
          // Map visualization index to frequency index (logarithmic-ish or linear mapping)
          // We focus on the lower half of frequencies where voice usually resides
          const freqIndex = Math.floor(i * (bufferLength / 2.5) / barsToDraw);
          const value = dataArray[freqIndex] || 0;
          const percent = value / 255;
          const height = Math.max(4, percent * (renderHeight * 0.8));

          const xOffset = i * (width + spacing);
          const opacity = Math.max(0.2, percent);

          ctx.fillStyle = `rgba(${themeRgbString}, ${opacity})`;

          // Right side
          drawRoundedRect(ctx, cx + xOffset - width / 2, (renderHeight - height) / 2, width, height, width / 2);

          // Left side
          drawRoundedRect(ctx, cx - xOffset - width / 2, (renderHeight - height) / 2, width, height, width / 2);
        }

      } else {
        // Idle state: pulsing dots line
        const cx = renderWidth / 2;
        const width = 4;
        const height = 4;
        const spacing = 8;
        const dots = 20;

        const time = Date.now() / 1000;

        for (let i = 0; i <= dots; i++) {
          const xOffset = i * (width + spacing);
          // Subtle wave effect
          const alpha = 0.1 + Math.abs(Math.sin(time + i * 0.2)) * 0.2;

          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

          if (i === 0) {
            drawRoundedRect(ctx, cx - width / 2, (renderHeight - height) / 2, width, height, width / 2);
          } else {
            drawRoundedRect(ctx, cx + xOffset - width / 2, (renderHeight - height) / 2, width, height, width / 2);
            drawRoundedRect(ctx, cx - xOffset - width / 2, (renderHeight - height) / 2, width, height, width / 2);
          }
        }
      }
    };

    animate();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, analyser]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Helper for rounded rects if ctx.roundRect is not fully supported or for simpler control
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (h < w) r = h / 2; // Cap radius
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  } else {
    // Fallback
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
}

export default AudioVisualizer;