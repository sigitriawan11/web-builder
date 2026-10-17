import { type LinkValue, LinkValueSchema, normalizeLinkInput } from "@platform/document-model";
import { cn, Input, Popover, PopoverContent, PopoverTrigger } from "@platform/ui";
import type { Editor } from "@tiptap/react";
import { LinkIcon } from "lucide-react";
import { useState } from "react";
import { useT } from "../../app/i18n";

// ED-122: popover tautan teks. Tipe standalone (URL/email/telepon/WhatsApp) — page/anchor/asset menyusul bersama
// picker navigasi (T2.15.4). Sanitasi dijamin `LinkValueSchema` (url hanya http(s); `javascript:` dll. ditolak).
type LinkType = "url" | "email" | "phone" | "whatsapp";
const TYPES: readonly LinkType[] = ["url", "email", "phone", "whatsapp"];

function toInput(link: LinkValue | null): { type: LinkType; value: string } {
  if (link?.type === "url") return { type: "url", value: link.href };
  if (link?.type === "email") return { type: "email", value: link.to };
  if (link?.type === "phone") return { type: "phone", value: link.phone };
  if (link?.type === "whatsapp") return { type: "whatsapp", value: link.phone };
  return { type: "url", value: "" };
}

function buildLink(type: LinkType, value: string): unknown {
  const v = value.trim();
  if (type === "url") return { type: "url", href: v };
  if (type === "email") return { type: "email", to: v };
  if (type === "phone") return { type: "phone", phone: v };
  return { type: "whatsapp", phone: v };
}

export function LinkPopover({ editor }: { editor: Editor }) {
  const t = useT();
  const current = (editor.getAttributes("link").link ?? null) as LinkValue | null;
  const initial = toInput(current);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<LinkType>(initial.type);
  const [value, setValue] = useState(initial.value);
  const [error, setError] = useState(false);

  const apply = () => {
    const parsed = LinkValueSchema.safeParse(normalizeLinkInput(buildLink(type, value)));
    if (!parsed.success) {
      setError(true);
      return;
    }
    editor.chain().focus().setMark("link", { link: parsed.data }).run();
    setOpen(false);
  };
  const remove = () => {
    editor.chain().focus().unsetMark("link").run();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const reset = toInput((editor.getAttributes("link").link ?? null) as LinkValue | null);
          setType(reset.type);
          setValue(reset.value);
          setError(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("inspector.link")}
          title={t("inspector.link")}
          data-testid="mark-link"
          className={cn(
            "flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
            editor.isActive("link") && "bg-accent text-foreground",
          )}
        >
          <LinkIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2 p-2">
        <select
          aria-label={t("inspector.linkType")}
          data-testid="link-type"
          value={type}
          onChange={(event) => setType(event.target.value as LinkType)}
          className="h-7 w-full rounded border border-input bg-transparent px-1 text-xs"
        >
          {TYPES.map((option) => (
            <option key={option} value={option}>
              {t(`inspector.link_${option}`)}
            </option>
          ))}
        </select>
        <Input
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(false);
          }}
          onKeyDown={(event) => event.key === "Enter" && apply()}
          aria-label={t("inspector.linkValue")}
          aria-invalid={error || undefined}
          data-testid="link-value"
          placeholder={t(`inspector.linkHint_${type}`)}
          className={cn("h-7 text-xs", error && "border-destructive")}
        />
        <div className="flex justify-between">
          {editor.isActive("link") ? (
            <button
              type="button"
              onClick={remove}
              data-testid="link-remove"
              className="rounded px-2 py-1 text-xs text-destructive hover:bg-accent"
            >
              {t("inspector.linkRemove")}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={apply}
            data-testid="link-apply"
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
          >
            {t("inspector.linkApply")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
