// @platform/sdk: client HTTP Platform API bertipe dari @platform/shared/contracts (ARCHITECTURE §4.2).
// Dipakai web (Client & Server Component) dan editor.
export {
  type ApiClient,
  type ApiClientOptions,
  createApiClient,
  DEFAULT_TIMEOUT_MS,
  type HttpMethod,
  type QueryValue,
  REQUEST_ID_HEADER,
  type RequestOptions,
} from "./client";
export { createPlatformApi, type PlatformApi } from "./endpoints";
export { ApiError, CLIENT_ERROR_CODES, type ClientErrorCode, isApiError } from "./errors";
