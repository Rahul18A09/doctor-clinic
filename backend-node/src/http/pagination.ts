import { InvalidPaginationError } from "./errors";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;

export type PaginationMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
};

export type ParsedPagination = {
  page: number;
  page_size: number;
  skip: number;
  limit: number;
};

export type PaginatedData<T> = {
  results: T[];
  pagination: PaginationMeta;
};

function lastQueryValue(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw[raw.length - 1] : undefined;
  }
  return raw;
}

/**
 * Python `int()` for query strings: optional sign, digits only, surrounding whitespace.
 * Non-numeric values throw, matching Django `int(request.query_params.get(...))`.
 */
export function parseQueryInt(raw: unknown, defaultValue: number): number {
  const value = lastQueryValue(raw);
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new InvalidPaginationError();
    }
    return value;
  }
  if (typeof value !== "string") {
    throw new InvalidPaginationError();
  }
  const trimmed = value.trim();
  if (!/^[-+]?\d+$/.test(trimmed)) {
    throw new InvalidPaginationError();
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new InvalidPaginationError();
  }
  return parsed;
}

function clampPage(page: number): number {
  return Math.max(page, DEFAULT_PAGE);
}

function clampPageSize(pageSize: number): number {
  return Math.min(Math.max(pageSize, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
}

/**
 * Django list pagination:
 * page      = max(int(page, 1), 1)
 * page_size = min(max(int(page_size, 10), 1), 100)
 */
export function parsePagination(query: {
  page?: unknown;
  page_size?: unknown;
} = {}): ParsedPagination {
  const page = clampPage(parseQueryInt(query.page, DEFAULT_PAGE));
  const page_size = clampPageSize(parseQueryInt(query.page_size, DEFAULT_PAGE_SIZE));
  return {
    page,
    page_size,
    skip: (page - 1) * page_size,
    limit: page_size,
  };
}

/**
 * total_pages = max(ceil(total / page_size), 1)
 * has_next    = page < total_pages
 * has_previous = page > 1
 *
 * A page past the last page still echoes the requested page; results are empty.
 */
export function buildPaginationMeta(
  parsed: Pick<ParsedPagination, "page" | "page_size">,
  total: number,
): PaginationMeta {
  const total_pages = Math.max(Math.ceil(total / parsed.page_size), 1);
  return {
    page: parsed.page,
    page_size: parsed.page_size,
    total,
    total_pages,
    has_next: parsed.page < total_pages,
    has_previous: parsed.page > 1,
  };
}

export function paginateItems<T>(
  items: readonly T[],
  query: { page?: unknown; page_size?: unknown } = {},
): PaginatedData<T> {
  const parsed = parsePagination(query);
  const pagination = buildPaginationMeta(parsed, items.length);
  const results = items.slice(parsed.skip, parsed.skip + parsed.limit);
  return { results, pagination };
}
