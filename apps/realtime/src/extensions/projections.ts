import type { Extension, onStoreDocumentPayload } from "@hocuspocus/server";
import { type Db, systemScope } from "@platform/db";
import { SiteDocumentSchema, summarizePages, yDocToJson } from "@platform/document-model";
import type { Logger } from "@platform/shared/node";
import type { RealtimeContext } from "../auth";
import { replaceSitePages } from "../persistence/documents.repository";

// ARCHITECTURE §5.5: setelah store (onStoreDocument Hocuspocus, debounce + saat unload), ekstrak read model halaman
// ke `site_pages`. Ditulis hanya bila hasil proyeksi berubah; dokumen tidak valid → read model terakhir dipertahankan.

export interface ProjectionsOptions {
  db: Db;
  logger: Logger;
}

export class ProjectionsExtension implements Extension {
  // Proyeksi terakhir yang ditulis per dokumen (JSON) — hindari menulis ulang tiap store.
  private readonly last = new Map<string, string>();

  constructor(private readonly options: ProjectionsOptions) {}

  async onStoreDocument({ documentName, document }: onStoreDocumentPayload<RealtimeContext>): Promise<void> {
    const parsed = SiteDocumentSchema.safeParse(yDocToJson(document));
    if (!parsed.success) {
      this.options.logger.warn(
        { docId: documentName, issues: parsed.error.issues.slice(0, 5).map((issue) => issue.message) },
        "proyeksi site_pages dilewati: dokumen tidak valid",
      );
      return;
    }
    const pages = summarizePages(parsed.data);
    const key = JSON.stringify(pages);
    if (this.last.get(documentName) === key) return;
    const written = await replaceSitePages(
      this.options.db,
      systemScope("realtime: proyeksi site_pages"),
      documentName,
      pages,
    );
    this.last.set(documentName, key);
    if (written) this.options.logger.debug({ docId: documentName, pages: pages.length }, "site_pages diperbarui");
  }

  async afterUnloadDocument({ documentName }: { documentName: string }): Promise<void> {
    this.last.delete(documentName);
  }
}
