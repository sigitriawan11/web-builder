import { Popover, PopoverContent, PopoverTrigger } from "@platform/ui";
import { useState } from "react";
import { HexAlphaColorPicker } from "react-colorful";
import { useT } from "../../../app/i18n";
import { normalizeHex } from "./color";

// ED-102: input warna — swatch pemicu membuka popover dengan react-colorful (hex + alpha), field hex, & swatch dokumen.
export function ColorInput({
  value,
  onChange,
  swatches,
  tokens,
  onPickToken,
  readOnly,
  testId,
}: {
  value: string;
  onChange: (hex: string) => void;
  swatches?: readonly string[];
  // ED-129: token warna tema (path + warna ter-resolve untuk preview); memilih → simpan ref `{$token}`.
  tokens?: readonly { path: string; color: string }[];
  onPickToken?: (path: string) => void;
  readOnly?: boolean;
  testId?: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={readOnly}
          aria-label={t("inspector.color")}
          data-testid={testId}
          className="size-5 shrink-0 rounded border border-border disabled:opacity-40"
          style={{ background: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2 p-2" align="start">
        <HexAlphaColorPicker color={value} onChange={onChange} />
        <input
          aria-label={t("inspector.colorHex")}
          data-testid={testId ? `${testId}-hex` : undefined}
          className="h-7 w-full rounded border bg-muted/50 px-2 text-xs tabular-nums"
          value={draft ?? value}
          onChange={(event) => {
            setDraft(event.target.value);
            const normalized = normalizeHex(event.target.value);
            if (normalized) onChange(normalized);
          }}
          onBlur={() => setDraft(null)}
        />
        {swatches && swatches.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {swatches.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                data-testid={testId ? `${testId}-swatch` : undefined}
                className="size-5 rounded border border-border"
                style={{ background: swatch }}
                onClick={() => onChange(swatch)}
              />
            ))}
          </div>
        ) : null}
        {tokens && tokens.length > 0 ? (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t("inspector.token")}</span>
            <div className="flex flex-wrap gap-1">
              {tokens.map((token) => (
                <button
                  key={token.path}
                  type="button"
                  aria-label={token.path}
                  title={token.path}
                  data-testid={testId ? `${testId}-token-${token.path}` : undefined}
                  className="size-5 rounded border border-border"
                  style={{ background: token.color }}
                  onClick={() => onPickToken?.(token.path)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
