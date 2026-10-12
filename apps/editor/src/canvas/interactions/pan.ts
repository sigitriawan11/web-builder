// Logika murni pan (ED-026); event DOM ditangani di use-pan-interactions.ts.

// Nilai `WheelEvent.deltaMode`.
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
// ED-026: Firefox & sebagian mouse mengirim delta dalam baris.
export const LINE_HEIGHT_PX = 16;

export interface WheelInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  shiftKey: boolean;
}

// Mengubah wheel/trackpad scroll menjadi geseran dalam px screen.
export function wheelToPanDelta(input: WheelInput, pageHeightPx: number): { dx: number; dy: number } {
  const scale =
    input.deltaMode === DOM_DELTA_LINE ? LINE_HEIGHT_PX : input.deltaMode === DOM_DELTA_PAGE ? pageHeightPx : 1;
  let dx = input.deltaX * scale;
  let dy = input.deltaY * scale;
  // Shift + wheel mouse = pan horizontal. Sebagian browser sudah menukar sumbunya sendiri.
  if (input.shiftKey && dx === 0) {
    dx = dy;
    dy = 0;
  }
  return { dx, dy };
}

// Scroll ke bawah menggeser konten ke atas, jadi kamera bergerak berlawanan arah delta.
export function panCamera<C extends { x: number; y: number }>(camera: C, dx: number, dy: number): Pick<C, "x" | "y"> {
  return { x: camera.x - dx, y: camera.y - dy };
}

export interface EditableTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

// ED-026: Space saat mengetik harus menghasilkan spasi, bukan pan.
export function isEditableTarget(target: EditableTargetLike | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// Tombol pointer yang memulai pan: tengah selalu; kiri hanya saat Space ditahan (atau hand tool, T0.3.5).
export function startsPan(button: number, spaceHeld: boolean): boolean {
  return button === 1 || (button === 0 && spaceHeld);
}
