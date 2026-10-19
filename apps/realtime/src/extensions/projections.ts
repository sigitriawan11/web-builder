import type { Extension, onStoreDocumentPayload } from "@hocuspocus/server";
import { type Db, systemScope } from "@platform/db";
import { collectComponentUsage, SiteDocumentSchema, summarizePages, yDocToJson } from "@platform/document-model";
import type { Logger } from "@platform/shared/node";
import type { RealtimeContext } from "../auth";
import { replaceSiteComponentUsage } from "../persistence/component-usage.repository";
import { replaceSitePages } from "../persistence/documents.repository";

// ARCHITECTURE §5.5: setelah store (onStoreDocument Hocuspocus, debounce + saat unload), ekstrak read model halaman
// ke `site_pages` dan pemakaian component ke `site_component_usage` (CMP-051, docState `draft`). Ditulis hanya bila
// hasil proyeksi berubah; dokumen tidak valid → read model terakhir dipertahankan. onStoreDocument sudah di luar jalur
// kritis autosave (Hocuspocus men-debounce store) → tidak memblok editor (CMP-051 AC).

export interface ProjectionsOptions {
  db: Db;
  logger: Logger;
}

export class ProjectionsExtension implements Extension {
  // Proyeksi terakhir yang ditulis per dokumen (JSON) — hindari menulis ulang tiap store.
  private readonly last = new Map<string, string>();
  private readonly lastUsage = new Map<string, string>();

  constructor(private readonly options: ProjectionsOptions) {}

  async onStoreDocument({ documentName, document }: onStoreDocumentPayload<RealtimeContext>): Promise<void> {
    const parsed = SiteDocumentSchema.safeParse(yDocToJson(document));
    if (!parsed.success) {
      this.options.logger.warn(
        { docId: documentName, issues: parsed.error.issues.slice(0, 5).map((issue) => issue.message) },
        "proyeksi dilewati: dokumen tidak valid",
      );
      return;
    }
    await this.projectPages(documentName, parsed.data);
    await this.projectUsage(documentName, parsed.data);
  }

  private async projectPages(documentName: string, doc: Parameters<typeof summarizePages>[0]): Promise<void> {
    const pages = summarizePages(doc);
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

  private async projectUsage(documentName: string, doc: Parameters<typeof collectComponentUsage>[0]): Promise<void> {
    const usage = collectComponentUsage(doc);
    const key = JSON.stringify(usage);
    if (this.lastUsage.get(documentName) === key) return;
    const result = await replaceSiteComponentUsage(
      this.options.db,
      systemScope("realtime: proyeksi site_component_usage"),
      documentName,
      "draft",
      usage,
    );
    this.lastUsage.set(documentName, key);
    if (result.written) {
      this.options.logger.debug(
        { docId: documentName, recorded: result.recorded, skipped: result.skipped.length },
        "site_component_usage diperbarui",
      );
      if (result.skipped.length > 0) {
        this.options.logger.warn(
          { docId: documentName, skipped: result.skipped.slice(0, 5) },
          "usage: referensi component tak ter-resolve (component/versi belum ada di DB)",
        );
      }
    }
  }

  async afterUnloadDocument({ documentName }: { documentName: string }): Promise<void> {
    this.last.delete(documentName);
    this.lastUsage.delete(documentName);
  }
}
