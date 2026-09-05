export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/** Parses & clamps page/limit query params. Never trusts the client for arbitrarily large limits. */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
  let page = Number(query.page ?? 1);
  let limit = Number(query.limit ?? DEFAULT_LIMIT);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  page = Math.floor(page);
  limit = Math.floor(limit);

  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
