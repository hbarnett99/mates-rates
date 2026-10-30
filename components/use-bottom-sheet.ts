'use client';

import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

export type Snap = 'peek' | 'half' | 'full';

/** How much of the sheet shows at "peek": the handle and the first line of the list. */
const PEEK_PX = 112;
/** A drag shorter than this counts as a tap on the handle. */
const TAP_PX = 6;

/** Offset from the fully open position, as CSS, before we know the sheet's height. */
const SNAP_CSS: Record<Snap, string> = {
  full: '0px',
  half: '50%',
  peek: `calc(100% - ${PEEK_PX}px)`,
};

function snapOffsets(height: number): Record<Snap, number> {
  return { full: 0, half: height * 0.5, peek: Math.max(0, height - PEEK_PX) };
}

/**
 * The phone's bottom sheet over the map, with three snap points. Drag the
 * handle to move it; let go and it settles on the nearest snap. Tapping the
 * handle toggles between peek and half.
 */
export function useBottomSheet() {
  const ref = useRef<HTMLElement | null>(null);
  const [snap, setSnap] = useState<Snap>('peek');
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const drag = useRef<{ startY: number; base: number; height: number } | null>(null);

  const snapTo = useCallback((next: Snap) => setSnap(next), []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const height = ref.current?.clientHeight ?? 0;
      drag.current = { startY: e.clientY, base: snapOffsets(height)[snap], height };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [snap],
  );

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const offsets = snapOffsets(d.height);
    const next = Math.min(offsets.peek, Math.max(0, d.base + e.clientY - d.startY));
    setDragOffset(next);
  }, []);

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      drag.current = null;
      setDragOffset(null);
      if (!d) return;
      const moved = e.clientY - d.startY;
      if (Math.abs(moved) < TAP_PX) {
        setSnap(snap === 'peek' ? 'half' : 'peek');
        return;
      }
      const offsets = snapOffsets(d.height);
      const at = d.base + moved;
      const nearest = (Object.keys(offsets) as Snap[]).reduce((best, s) =>
        Math.abs(offsets[s] - at) < Math.abs(offsets[best] - at) ? s : best,
      );
      setSnap(nearest);
    },
    [snap],
  );

  // A CSS variable rather than a transform, so the page applies it only below
  // the desktop breakpoint, even in server-rendered HTML.
  const style = useMemo(
    () => ({ '--sheet-y': dragOffset !== null ? `${dragOffset}px` : SNAP_CSS[snap] }) as CSSProperties,
    [dragOffset, snap],
  );

  return {
    ref,
    snap,
    snapTo,
    style,
    dragging: dragOffset !== null,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
