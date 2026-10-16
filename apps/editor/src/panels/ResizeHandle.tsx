import { type KeyboardEvent, type PointerEvent, useRef } from "react";

const KEYBOARD_STEP = 16;

interface ResizeHandleProps {
  // Sisi panel tempat pegangan berada: "end" = tepi kanan (sidebar kiri), "start" = tepi kiri (inspector).
  edge: "start" | "end";
  width: number;
  min: number;
  max: number;
  label: string;
  onResize(width: number): void;
  testId: string;
}

/** Pegangan resize panel (WAI-ARIA window splitter): drag pointer atau panah kiri/kanan ±16 px saat fokus. */
export function ResizeHandle({ edge, width, min, max, label, onResize, testId }: ResizeHandleProps) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  // Tepi kanan: geser kanan = lebih lebar; tepi kiri: geser kiri = lebih lebar.
  const direction = edge === "end" ? 1 : -1;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onResize(drag.current.startWidth + direction * (event.clientX - drag.current.startX));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") onResize(width - direction * KEYBOARD_STEP);
    else if (event.key === "ArrowRight") onResize(width + direction * KEYBOARD_STEP);
    else return;
    event.preventDefault();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: separator interaktif (WAI-ARIA window splitter), bukan <hr>.
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      data-testid={testId}
      className={`absolute inset-y-0 ${edge === "end" ? "-right-1" : "-left-1"} z-10 w-2 cursor-col-resize hover:bg-ring/30 focus-visible:bg-ring/40`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        drag.current = null;
      }}
      onKeyDown={onKeyDown}
    />
  );
}
