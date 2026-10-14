import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../client";
import { createPlatformApi } from "../endpoints";
import { createMutations, createQueries, queryKeys } from "./queries";

const WS = "01a135f2-b6cc-77fb-893d-af4f62d11c71";
const site = (name: string) => ({
  id: "01a135f2-b67d-71b3-9fbc-775f6ef635e9",
  workspaceId: WS,
  name,
  status: "draft",
  documentId: "01a135f2-b6cc-77fb-893d-af4f62d11c72",
  createdAt: "2026-10-14T01:00:00.000Z",
  updatedAt: "2026-10-14T01:00:00.000Z",
});

/** API palsu: GET daftar → [site], POST/PATCH → site, DELETE → 204. */
function setup() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (method === "GET" && url.includes("/workspaces/"))
      return Response.json({ data: [site("Toko")], meta: { requestId: "r", nextCursor: null } });
    const body = init?.body ? (JSON.parse(String(init.body)) as { name: string }) : { name: "Toko" };
    return Response.json({ data: site(body.name), meta: { requestId: "r" } });
  });
  const api = createPlatformApi(createApiClient({ baseUrl: "/api", fetch: fetchMock }));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { fetchMock, queryClient, queries: createQueries(api), mutations: createMutations(api, queryClient) };
}

const listCalls = (fetchMock: ReturnType<typeof setup>["fetchMock"]) =>
  fetchMock.mock.calls.filter(
    ([url, init]) => String(url).includes("/workspaces/") && (init?.method ?? "GET") === "GET",
  ).length;

describe("query options & mutasi TanStack", () => {
  it("query key hierarkis: list & detail di bawah ['sites']", () => {
    expect(queryKeys.sites.list(WS, { sort: "name" })).toEqual(["sites", "list", WS, { sort: "name" }]);
    expect(queryKeys.sites.detail("s1")).toEqual(["sites", "detail", "s1"]);
    expect(queryKeys.sites.list(WS)[0]).toBe(queryKeys.sites.all[0]);
  });

  it("buat situs → daftar situs ditandai basi (diambil ulang saat dipakai)", async () => {
    const { fetchMock, queryClient, queries, mutations } = setup();
    await queryClient.fetchQuery(queries.sites(WS));
    expect(listCalls(fetchMock)).toBe(1);
    await mutations.createSite({ workspaceId: WS, name: "Baru" });
    expect(queryClient.getQueryState(queryKeys.sites.list(WS))?.isInvalidated).toBe(true);
    await queryClient.fetchQuery(queries.sites(WS));
    expect(listCalls(fetchMock)).toBe(2);
  });

  it("ganti nama → cache detail langsung berisi nama baru; hapus → cache detail dibuang", async () => {
    const { queryClient, queries, mutations } = setup();
    await queryClient.fetchQuery(queries.site(site("Toko").id));
    await mutations.renameSite({ siteId: site("Toko").id, name: "Toko Baru" });
    expect(queryClient.getQueryData(queryKeys.sites.detail(site("Toko").id))).toMatchObject({ name: "Toko Baru" });

    await mutations.removeSite(site("Toko").id);
    expect(queryClient.getQueryData(queryKeys.sites.detail(site("Toko").id))).toBeUndefined();
  });
});
