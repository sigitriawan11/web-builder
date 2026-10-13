import { createServer } from "node:net";
import { createLogger, type Logger } from "@platform/shared/node";

// Port kosong untuk test yang benar-benar listen.
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("port"))));
    });
  });
}

// Logger senyap untuk test (output dibuang).
export const silentLogger = (): Logger =>
  createLogger({ service: "api", env: "test", destination: { write: () => {} } });
