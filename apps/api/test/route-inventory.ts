import type { Express } from "express";
import { MOUNT_PATH_TAG } from "../src/lib/mount";
import { TENANT_RESOLVER_TAG } from "../src/middleware/tenant-resolver";

// Inventaris rute aplikasi untuk test (ARCHITECTURE §9.5): signature `METHOD /path/lengkap`. Path mount dicatat
// `mountAt` (Express 5 tidak menyimpannya); membaca struktur internal router Express 5 — hanya untuk test.

interface RouteLike {
  path: string;
  methods: Record<string, boolean>;
  stack: { handle: unknown }[];
}
interface LayerLike {
  handle: unknown;
  route?: RouteLike;
}

export interface InventoryRoute {
  signature: string;
  // Melewati tenantResolver (di mount induk sebelum rute, atau di handler rute itu sendiri).
  tenantProtected: boolean;
}

const mountPath = (handle: unknown): string | undefined =>
  typeof handle === "function" ? ((handle as unknown as Record<symbol, unknown>)[MOUNT_PATH_TAG] as string) : undefined;

const join = (...parts: string[]) =>
  `/${parts
    .flatMap((part) => part.split("/"))
    .filter(Boolean)
    .join("/")}`;

const tagged = (handle: unknown) =>
  typeof handle === "function" && TENANT_RESOLVER_TAG in (handle as unknown as Record<symbol, unknown>);

function walk(stack: LayerLike[], prefix: string, protectedSoFar: boolean, out: InventoryRoute[]): void {
  let isProtected = protectedSoFar;
  for (const layer of stack) {
    if (tagged(layer.handle)) isProtected = true;
    if (layer.route) {
      const routeProtected = isProtected || layer.route.stack.some((handler) => tagged(handler.handle));
      for (const method of Object.keys(layer.route.methods)) {
        out.push({
          signature: `${method.toUpperCase()} ${join(prefix, layer.route.path)}`,
          tenantProtected: routeProtected,
        });
      }
      continue;
    }
    const nested = (layer.handle as { stack?: LayerLike[] }).stack;
    if (Array.isArray(nested)) walk(nested, join(prefix, mountPath(layer.handle) ?? ""), isProtected, out);
  }
}

export function listRoutes(app: Express): InventoryRoute[] {
  const out: InventoryRoute[] = [];
  walk((app as unknown as { router: { stack: LayerLike[] } }).router.stack, "", false, out);
  return out;
}
