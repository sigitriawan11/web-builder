import { RealtimeTokenBodySchema } from "@platform/shared/contracts";

// Zod request modul realtime-token. Bentuk body/response = `@platform/shared/contracts/realtime-token.ts`.
export const issueRealtimeTokenRequest = { body: RealtimeTokenBodySchema };
