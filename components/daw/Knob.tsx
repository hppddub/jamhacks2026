'use client';

import { useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  size?: number;
  format?: (v: number) => string;
}

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

/** Point on a circle where deg is measured clockwise from 12 o'clock. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(cx, cy, r, startDeg);
  const [ex, ey] = polar(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

/** A draggable rotary knob (drag up/down or scroll to change). */
export function Knob({ label, value, min, max, step, onChange, size = 40, format }: KnobProps) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);
  const range = max - min || 1;
  const norm = Math.max(0, Math.min(1, (value - min) / range));
  const angle = MIN_ANGLE + norm * (MAX_ANGLE - MIN_ANGLE);

  const commit = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v / step) * step)));

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startVal: value };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - ev.clientY; // up = increase
      commit(dragRef.current.startVal + (dy / 150) * range);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    commit(value + (e.deltaY < 0 ? 1 : -1) * step * 4);
  };

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const [ix, iy] = polar(cx, cy, r - 3, angle);
  const display = format ? format(value) : `${Math.round(value * 100) / 100}`;

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <svg
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
        className="cursor-ns-resize touch-none"
      >
        {/* Track */}
        <path d={arcPath(cx, cy, r, MIN_ANGLE, MAX_ANGLE)} fill="none" stroke="#2D4B6E" strokeWidth={3} strokeLinecap="round" />
        {/* Value arc */}
        {norm > 0.001 && (
          <path d={arcPath(cx, cy, r, MIN_ANGLE, angle)} fill="none" stroke="#ffcc18" strokeWidth={3} strokeLinecap="round" />
        )}
        {/* Body */}
        <circle cx={cx} cy={cy} r={r - 6} fill="#1F3550" stroke="#243D5C" strokeWidth={1} />
        {/* Indicator */}
        <line x1={cx} y1={cy} x2={ix} y2={iy} stroke="#ffcc18" strokeWidth={2} strokeLinecap="round" />
      </svg>
      <span className="text-[9px] font-medium text-cream-300">{label}</span>
      <span className="text-[8px] tabular-nums text-cream-500">{display}</span>
    </div>
  );
}
