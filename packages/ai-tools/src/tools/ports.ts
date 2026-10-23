// Port efek-samping untuk tool AI (di-inject worker/api). ai-tools tetap murni (ARCHITECTURE §4.2).

export interface LibrarySearchResult {
  componentId: string;
  name: string;
  version: number;
  categorySlug?: string;
}

export interface AiToolPorts {
  // AI-102/CMP-158: cari component published di library (worker inject repository-backed search).
  searchComponents?: (query: { query?: string; category?: string; limit?: number }) => Promise<LibrarySearchResult[]>;
}
