import {
  type LinkValue,
  LinkValueSchema,
  type Node,
  normalizeLinkInput,
  type SiteDocument,
} from "@platform/document-model";

// ED-181 / DM-055: logika murni editor tautan node (dipisah dari komponen agar bisa diuji unit). Nilai akhir selalu
// divalidasi `LinkValueSchema` (http(s) saja; nomor dinormalisasi ke 62…).

export const LINKABLE_TYPES: readonly Node["type"][] = ["frame", "image", "shape", "icon"];
export type LinkKind = "page" | "anchor" | "url" | "email" | "phone" | "whatsapp";
export const LINK_KINDS: readonly LinkKind[] = ["page", "anchor", "url", "email", "phone", "whatsapp"];

export interface LinkForm {
  value: string;
  pageId: string;
  anchorId: string;
  newTab: boolean;
}

/** Page id dari sebuah node dengan menyusuri parentId (DM-006: hanya page yang ber-parent null). */
export function pageOf(nodes: SiteDocument["nodes"], nodeId: string): string | null {
  let current: Node | undefined = nodes[nodeId];
  while (current?.parentId) current = nodes[current.parentId];
  return current?.type === "page" ? current.id : null;
}

/** Bentuk calon LinkValue dari pilihan form (belum divalidasi); `null` bila target kosong. */
export function draftLink(kind: LinkKind, form: LinkForm): unknown {
  switch (kind) {
    case "page":
      return form.pageId ? { type: "page", pageId: form.pageId } : null;
    case "anchor":
      return form.anchorId ? { type: "anchor", nodeId: form.anchorId } : null;
    case "url":
      return { type: "url", href: form.value.trim(), ...(form.newTab ? { newTab: true } : {}) };
    case "email":
      return { type: "email", to: form.value.trim() };
    case "phone":
      return { type: "phone", phone: form.value };
    case "whatsapp":
      return { type: "whatsapp", phone: form.value };
  }
}

/** Validasi + normalisasi form menjadi LinkValue, atau `null` bila tidak valid. */
export function buildNodeLink(kind: LinkKind, form: LinkForm): LinkValue | null {
  const parsed = LinkValueSchema.safeParse(normalizeLinkInput(draftLink(kind, form)));
  return parsed.success ? parsed.data : null;
}

/** Nilai form awal dari link node yang ada (untuk mengisi popover saat dibuka). */
export function formFromLink(link: LinkValue | undefined): { kind: LinkKind; form: LinkForm } {
  const form: LinkForm = { value: "", pageId: "", anchorId: "", newTab: false };
  switch (link?.type) {
    case "page":
      return { kind: "page", form: { ...form, pageId: link.pageId } };
    case "anchor":
      return { kind: "anchor", form: { ...form, anchorId: link.nodeId } };
    case "url":
      return { kind: "url", form: { ...form, value: link.href, newTab: link.newTab ?? false } };
    case "email":
      return { kind: "email", form: { ...form, value: link.to } };
    case "phone":
      return { kind: "phone", form: { ...form, value: link.phone } };
    case "whatsapp":
      return { kind: "whatsapp", form: { ...form, value: link.phone } };
    default:
      return { kind: "url", form };
  }
}

/** Ringkasan singkat tautan untuk tombol inspector. */
export function summarizeLink(link: LinkValue, pages: readonly { id: string; title: string }[]): string {
  switch (link.type) {
    case "page":
      return pages.find((page) => page.id === link.pageId)?.title ?? "page";
    case "anchor":
      return `#${link.nodeId}`;
    case "url":
      return link.href;
    case "email":
      return link.to;
    case "phone":
      return `+${link.phone}`;
    case "whatsapp":
      return `wa.me/${link.phone}`;
    case "asset":
      return "asset";
  }
}
