export interface EditableTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

// Shortcut satu huruf & Space diabaikan saat user sedang mengetik (ED-026).
export function isEditableTarget(target: EditableTargetLike | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Target asli event keyboard. Event dari dalam shadow root (Opsi A isolasi canvas) di-retarget ke host
 * saat sampai di `window`, sehingga `event.target` bukan elemen yang sedang diketik (temuan T0.4.5).
 */
export function isEditableEvent(event: Event): boolean {
  const [origin] = event.composedPath();
  return isEditableTarget(origin instanceof HTMLElement ? origin : null);
}
