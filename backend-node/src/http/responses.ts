import type { Response } from "express";

import { firstErrorMessage, type FieldErrors } from "./errors";
import type { PaginationMeta } from "./pagination";

export type ApiSuccessResponse<T = unknown> = {
  success: true;
  message: string;
  data?: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errors?: Record<string, unknown>;
};

export type ApiDetailResponse = {
  detail: string;
};

export function successResponse<T>(
  res: Response,
  options: {
    message?: string;
    statusCode?: number;
    data?: T;
  } = {},
): Response {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    message: options.message ?? "Success",
  };
  if (options.data !== undefined) {
    payload.data = options.data;
  }
  return res.status(options.statusCode ?? 200).json(payload);
}

export function errorResponse(
  res: Response,
  options: {
    message?: string;
    statusCode?: number;
    errors?: FieldErrors | Record<string, unknown>;
  } = {},
): Response {
  const payload: ApiErrorResponse = {
    success: false,
    message: options.message ?? "Error",
  };
  if (options.errors !== undefined) {
    payload.errors = options.errors;
  }
  return res.status(options.statusCode ?? 400).json(payload);
}

export function detailResponse(
  res: Response,
  detail: string,
  statusCode: number,
): Response {
  const payload: ApiDetailResponse = { detail };
  return res.status(statusCode).json(payload);
}

export function notFoundResponse(res: Response, message: string): Response {
  return errorResponse(res, { message, statusCode: 404 });
}

export function validationErrorResponse(
  res: Response,
  errors: FieldErrors,
  fallback = "Validation failed.",
): Response {
  return errorResponse(res, {
    message: firstErrorMessage(errors, fallback),
    errors,
    statusCode: 400,
  });
}

export function paginatedSuccessResponse<T>(
  res: Response,
  options: {
    results: T[];
    pagination: PaginationMeta;
    message: string;
    statusCode?: number;
  },
): Response {
  return successResponse(res, {
    message: options.message,
    data: {
      results: options.results,
      pagination: options.pagination,
    },
    ...(options.statusCode !== undefined ? { statusCode: options.statusCode } : {}),
  });
}
