import { AcceptConsentsBodySchema } from "@platform/shared/contracts";
import { z } from "zod";

// Zod request modul account. Bentuk body/response = `@platform/shared/contracts/account.ts`.
export const getConsentsRequest = {};
export const acceptConsentsRequest = { body: AcceptConsentsBodySchema };
export const listSessionsRequest = {};
export const revokeSessionRequest = { params: z.object({ sessionId: z.uuid() }) };
export const revokeOtherSessionsRequest = {};
