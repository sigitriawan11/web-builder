import { AppError } from "@platform/shared";

// CMP-040: state machine status component. Transisi hanya lewat endpoint khusus (submit/approve/reject/publish/
// deprecate/archive/restore), divalidasi server. Fungsi murni (unit-testable tanpa DB).
export const COMPONENT_STATUSES = ["draft", "in_review", "published", "deprecated", "archived"] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];

// Transisi yang diizinkan (lihat diagram CMP-040). restore: deprecated→published; reject: in_review→draft.
const TRANSITIONS: Record<ComponentStatus, readonly ComponentStatus[]> = {
  draft: ["in_review"],
  in_review: ["published", "draft"],
  published: ["deprecated"],
  deprecated: ["published", "archived"],
  archived: [],
};

export function canTransition(from: ComponentStatus, to: ComponentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Lempar CONFLICT (409) bila transisi status tidak valid. */
export function assertComponentTransition(from: ComponentStatus, to: ComponentStatus): void {
  if (!canTransition(from, to))
    throw new AppError("CONFLICT", undefined, { reason: "invalid_status_transition", from, to });
}
