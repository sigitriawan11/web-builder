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
