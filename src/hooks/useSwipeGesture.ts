import { useRef, useState, type PointerEvent } from 'react';

export type SwipeDecision = 'pass' | 'interested';
type Drag = { id: number; x: number; y: number; axis?: 'horizontal' | 'vertical' };

export function useSwipeGesture(onSwipe: (decision: SwipeDecision) => void, disabled: boolean) {
  const drag = useRef<Drag | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  function resetDrag() {
    drag.current = null;
    setDragging(false);
    setOffset(0);
  }

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (disabled || !event.isPrimary || event.button !== 0) return;
      if ((event.target as Element).closest('button, a')) return;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const active = drag.current;
      if (!active || event.pointerId !== active.id) return;
      const x = event.clientX - active.x;
      const y = event.clientY - active.y;
      if (!active.axis && Math.max(Math.abs(x), Math.abs(y)) >= 10) {
        active.axis = Math.abs(x) > Math.abs(y) * 1.25 ? 'horizontal' : 'vertical';
      }
      if (active.axis === 'horizontal') {
        setDragging(true);
        setOffset(x);
      }
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      const active = drag.current;
      if (!active || event.pointerId !== active.id) return;
      const x = event.clientX - active.x;
      const threshold = Math.min(96, event.currentTarget.clientWidth * 0.25);
      resetDrag();
      if (!disabled && active.axis === 'horizontal' && Math.abs(x) >= threshold) {
        onSwipe(x > 0 ? 'interested' : 'pass');
      }
    },
    onPointerCancel: cancelDrag,
    onLostPointerCapture: cancelDrag,
  };

  function cancelDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId === drag.current?.id) resetDrag();
  }

  return { dragging, offset, resetDrag, handlers };
}
