/**
 * Standard API Response Envelopes & Error Contracts
 * Enforces docs/09-routes-and-api-spec.md Section 5.
 */

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiEnvelope<T = unknown> = ApiResponse<T> | ApiErrorResponse;

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_SERVER_ERROR"
  | "ORDER_ALREADY_ACCEPTED"
  | "ORDER_ALREADY_REJECTED"
  | "ORDER_NOT_READY"
  | "INVALID_PICKUP_CODE"
  | "PICKUP_CODE_LOCKED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "SUPPRESSED_RECIPIENT";

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

export function createErrorResponse(
  code: ApiErrorCode | string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
