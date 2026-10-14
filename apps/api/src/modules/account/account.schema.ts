import { AcceptConsentsBodySchema } from "@platform/shared/contracts";

// Zod request modul account. Bentuk body/response = `@platform/shared/contracts/account.ts`.
export const getConsentsRequest = {};
export const acceptConsentsRequest = { body: AcceptConsentsBodySchema };
