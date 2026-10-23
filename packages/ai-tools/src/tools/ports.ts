// Port efek-samping untuk tool AI (di-inject worker/api). ai-tools tetap murni (ARCHITECTURE §4.2).

export interface LibrarySearchResult {
  componentId: string;
  name: string;
  version: number;
  categorySlug?: string;
}

export interface CreateComponentDraftInput {
  slug: string;
  kind: string;
  name: string;
  displayName: { id: string; en: string };
  description: { id: string; en: string };
  // Subtree/ComponentDefinition awal (divalidasi server). AI hanya membuat draft; publish = manusia (AI-006).
  definition: unknown;
}

export interface AiToolPorts {
  // AI-102/CMP-158: cari component published di library (worker inject repository-backed search).
  searchComponents?: (query: { query?: string; category?: string; limit?: number }) => Promise<LibrarySearchResult[]>;
  // AI-006 (admin): buat draft component baru via library-admin service (DB + draft doc). Hanya mode admin_library.
  createComponentDraft?: (input: CreateComponentDraftInput) => Promise<{ componentId: string; publicId: string }>;
}
