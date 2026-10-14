import { type CSSProperties, createElement, type ReactNode } from "react";

// Primitives (ARCHITECTURE §4.2): elemen HTML dasar yang dipakai `render` untuk setiap tipe node. Tidak tahu Yjs,
// editor, atau tenant — hanya atribut siap pakai, sehingga sama di editor (React live) & publish (SSR statis).

type Attributes = Record<string, unknown>;

export interface BoxProps {
  tag: string;
  attributes: Attributes;
  children?: ReactNode;
}

export function Box({ tag, attributes, children }: BoxProps) {
  return createElement(tag, attributes, children);
}

export interface TextProps {
  tag: string;
  attributes: Attributes;
  style?: CSSProperties | undefined;
  children: ReactNode;
}

export function Text({ tag, attributes, style, children }: TextProps) {
  return createElement(tag, style ? { ...attributes, style } : attributes, children);
}

export interface ImageProps {
  attributes: Attributes;
  src: string;
  alt: string;
  width?: number | undefined;
  height?: number | undefined;
  loading: "lazy" | "eager";
  objectPosition?: string | undefined;
}

export function Image({ attributes, src, alt, width, height, loading, objectPosition }: ImageProps) {
  return createElement("img", {
    ...attributes,
    src,
    alt,
    // Ukuran intrinsik dari registry asset mencegah layout shift (CLS) saat gambar dimuat.
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    loading,
    decoding: "async",
    ...(objectPosition ? { style: { objectPosition } } : {}),
  });
}

export interface LinkProps {
  attributes: Attributes;
  children: ReactNode;
}

export function Link({ attributes, children }: LinkProps) {
  return createElement("a", attributes, children);
}
