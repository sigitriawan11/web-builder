// DM-076: sumber tunggal angka batas dokumen (teknis, bukan batas paket — itu `PLAN_LIMIT_REACHED`, spec 08).
// `soft` = peringatan (editor menampilkan, ED-223), `hard` = ditolak validator & command (`LIMIT_EXCEEDED`).

const MB = 1024 * 1024;

export const DOCUMENT_LIMITS = {
  nodesPerPage: { soft: 2_000, hard: 5_000 },
  nodesPerSite: { hard: 20_000 },
  pagesPerSite: { hard: 100 },
  treeDepth: { soft: 20, hard: 32 },
  childrenPerContainer: { hard: 500 },
  textCharsPerNode: { soft: 5_000, hard: 20_000 },
  tokensTotal: { hard: 500 },
  jsonSnapshotBytes: { soft: 6 * MB, hard: 12 * MB },
  yDocStateBytes: { soft: 8 * MB, hard: 16 * MB },
} as const satisfies Record<string, { soft?: number; hard: number }>;

export type LimitName = keyof typeof DOCUMENT_LIMITS;

export type LimitCheck = { limit: LimitName; value: number; max: number; level: "soft" | "hard" };

/** Bandingkan nilai dengan batas; `null` bila masih di bawah batas soft (atau hard bila tak ada soft). */
export function checkLimit(limit: LimitName, value: number): LimitCheck | null {
  const def: { soft?: number; hard: number } = DOCUMENT_LIMITS[limit];
  if (value > def.hard) return { limit, value, max: def.hard, level: "hard" };
  if (def.soft !== undefined && value > def.soft) return { limit, value, max: def.soft, level: "soft" };
  return null;
}

/**
 * Batas ukuran byte (DM-061/DM-076) untuk server: realtime menolak update Yjs yang membuat state melewati
 * `yDocStateBytes`, worker snapshot memeriksa `jsonSnapshotBytes`. Dipisah dari `validateDocument` karena
 * serialisasi dokumen penuh mahal untuk setiap validasi.
 */
export function checkByteLimit(limit: "jsonSnapshotBytes" | "yDocStateBytes", bytes: number): LimitCheck | null {
  return checkLimit(limit, bytes);
}
