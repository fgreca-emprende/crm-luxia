import { useState, useRef } from 'react';

export function useDraggable(dragThreshold = 5) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0, moved: false, currentX: 0, currentY: 0 });

  const handlePointerDown = (e) => {
    dragStart.current = {
      x: pos.x,
      y: pos.y,
      px: e.clientX,
      py: e.clientY,
      currentX: pos.x,
      currentY: pos.y,
      moved: false
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;

    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
      dragStart.current.moved = true;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    let newX = dragStart.current.x + dx;
    let newY = dragStart.current.y + dy;

    const initialLeft = rect.left - dragStart.current.currentX;
    const initialTop = rect.top - dragStart.current.currentY;

    const absoluteLeft = initialLeft + newX;
    const absoluteTop = initialTop + newY;

    const minLeft = 10;
    const maxLeft = window.innerWidth - width - 10;
    const minTop = 10;
    const maxTop = window.innerHeight - height - 10;

    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, absoluteLeft));
    const clampedTop = Math.max(minTop, Math.min(maxTop, absoluteTop));

    newX = clampedLeft - initialLeft;
    newY = clampedTop - initialTop;

    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleButtonClick = (e, action) => {
    if (dragStart.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    action();
  };

  return {
    pos,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleButtonClick
  };
}
