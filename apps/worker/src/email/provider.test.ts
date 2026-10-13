import { UnrecoverableError } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resendProvider } from "./provider";

const message = {
  from: "Platform <no-reply@platformmu.com>",
  to: "budi@contoh.id",
  subject: "Halo",
  html: "<p>Halo</p>",
  text: "Halo",
  idempotencyKey: "email:42",
};

afterEach(() => vi.unstubAllGlobals());

describe("resendProvider", () => {
  it("sukses → id pesan; idempotency key & auth terkirim", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(resendProvider("re_key").send(message)).resolves.toEqual({ providerMessageId: "msg_1" });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toMatchObject({ authorization: "Bearer re_key", "idempotency-key": "email:42" });
  });

  it.each([429, 500, 503])("HTTP %i → error biasa (di-retry)", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status })),
    );
    const error = await resendProvider("re_key")
      .send(message)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it.each([400, 401, 422])("HTTP %i → UnrecoverableError (tidak di-retry)", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status })),
    );
    await expect(resendProvider("re_key").send(message)).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
