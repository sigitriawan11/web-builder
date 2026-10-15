// Bus update dokumen dari penulis sisi server (AI headless, migrasi, update component massal) ke apps/realtime
// (ARCHITECTURE §5.5, §10): penulis SUDAH menyimpan update ke `document_updates`, lalu mem-publish update Yjs biner
// ke channel ini agar klien yang sedang terhubung ikut menerimanya.

export const DOCUMENT_UPDATE_CHANNEL_PREFIX = "doc-ext:";

export const documentUpdateChannel = (docId: string) => `${DOCUMENT_UPDATE_CHANNEL_PREFIX}${docId}`;
