import { cn } from "@platform/ui";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { useT } from "../../../app/i18n";
import { isMixed, type Mixed } from "../mixed";
import { evaluateExpression } from "./expression";

// ED-070: input numerik inspector bersama — ekspresi (`100/3`, `+=10`→`+10`), scrub label (±1/px, Shift ×10,
// Alt ×0.1), ↑/↓ ±1 (Shift ±10), Enter/Tab commit, Esc batal; invalid → berkedip merah & kembali ke nilai lama.

/** Fungsi nilai baru per node (multi-seleksi: ekspresi relatif dihitung dari nilai masing-masing node). */
export type NumberUpdate = (current: number) => number;

interface NumberInputProps {
  label: string;
  // Ikon/teks pendek label yang bisa di-scrub (mis. "W"); default = label.
  scrubLabel?: ReactNode;
  value: number | Mixed | undefined;
  onCommit(update: NumberUpdate): void;
  precision?: number;
  min?: number;
  max?: number;
  // Nilai khusus (mis. `auto`/`hug`/`fill` di W/H): kembalikan true bila ditangani pemanggil.
  onKeyword?: (keyword: string) => boolean;
  testId?: string;
}

const clamp = (value: number, min?: number, max?: number) =>
  Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value));

export function NumberInput({
  label,
  scrubLabel,
  value,
  onCommit,
  precision = 0,
  min,
  max,
  onKeyword,
  testId,
}: NumberInputProps) {
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const scrub = useRef<{ startX: number; moved: boolean } | null>(null);
  const factor = 10 ** precision;
  const round = (n: number) => Math.round(n * factor) / factor;
  const mixed = isMixed(value);
  const display = draft ?? (mixed || value === undefined ? "" : String(round(value)));

  const flashInvalid = () => {
    setInvalid(true);
    window.setTimeout(() => setInvalid(false), 600);
  };

  const commitText = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed === "" || (!mixed && value !== undefined && trimmed === String(round(value)))) return true;
    if (onKeyword && /^[a-z]+$/i.test(trimmed) && onKeyword(trimmed.toLowerCase())) return true;
    // Validasi sekali terhadap nilai acuan (nilai sekarang, atau 0 untuk "Mixed") sebelum diterapkan per node.
    const probe = evaluateExpression(trimmed, { current: mixed || value === undefined ? 0 : value, precision });
    if (!probe.ok) {
      flashInvalid();
      return false;
    }
    onCommit((current) => {
      const result = evaluateExpression(trimmed, { current, precision });
      return clamp(result.ok ? result.value : current, min, max);
    });
    return true;
  };

  const step = (delta: number) => {
    onCommit((current) => clamp(round(current + delta), min, max));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commitText(event.currentTarget.value);
      setDraft(null);
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(null);
      event.currentTarget.blur();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (draft !== null && !commitText(draft)) return;
      setDraft(null);
      step((event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1));
    }
  };

  const onScrubDown = (event: PointerEvent<HTMLSpanElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub.current = { startX: event.clientX, moved: false };
  };
  const onScrubMove = (event: PointerEvent<HTMLSpanElement>) => {
    const state = scrub.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    if (dx === 0) return;
    state.startX = event.clientX;
    state.moved = true;
    const multiplier = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
    step(dx * multiplier);
  };

  return (
    <label className="flex h-7 items-center gap-1 rounded border border-transparent bg-muted/50 px-1.5 text-xs hover:border-border focus-within:border-ring">
      <span
        className="cursor-ew-resize select-none text-muted-foreground"
        data-testid={testId ? `${testId}-scrub` : undefined}
        onPointerDown={onScrubDown}
        onPointerMove={onScrubMove}
        onPointerUp={() => {
          scrub.current = null;
        }}
      >
        {scrubLabel ?? label}
      </span>
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        data-testid={testId}
        inputMode="decimal"
        className={cn(
          "min-w-0 flex-1 bg-transparent tabular-nums outline-none placeholder:italic",
          invalid && "animate-pulse text-destructive",
        )}
        placeholder={mixed ? t("inspector.mixed") : undefined}
        value={display}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          // Tab/klik keluar = commit (ED-070).
          if (draft !== null) commitText(event.currentTarget.value);
          setDraft(null);
        }}
        onKeyDown={onKeyDown}
      />
    </label>
  );
}
