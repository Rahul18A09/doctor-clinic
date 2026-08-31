import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InvalidPaginationError } from "../../src/http/errors";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPaginationMeta,
  paginateItems,
  parsePagination,
  parseQueryInt,
} from "../../src/http/pagination";

describe("parsePagination", () => {
  it("defaults to page 1 and page_size 10", () => {
    const parsed = parsePagination({});
    assert.equal(parsed.page, 1);
    assert.equal(parsed.page_size, DEFAULT_PAGE_SIZE);
    assert.equal(parsed.skip, 0);
    assert.equal(parsed.limit, 10);
  });

  it("clamps page_size to a maximum of 100", () => {
    const parsed = parsePagination({ page_size: "1000" });
    assert.equal(parsed.page_size, MAX_PAGE_SIZE);
    assert.equal(parsed.limit, 100);
  });

  it("clamps page_size of 0 up to 1", () => {
    assert.equal(parsePagination({ page_size: "0" }).page_size, 1);
  });

  it("clamps page of 0 and negatives up to 1", () => {
    assert.equal(parsePagination({ page: "0" }).page, 1);
    assert.equal(parsePagination({ page: "-3" }).page, 1);
  });

  it("accepts an explicit page and page_size within bounds", () => {
    const parsed = parsePagination({ page: "3", page_size: "25" });
    assert.equal(parsed.page, 3);
    assert.equal(parsed.page_size, 25);
    assert.equal(parsed.skip, 50);
    assert.equal(parsed.limit, 25);
  });

  it("strips whitespace like Python int()", () => {
    const parsed = parsePagination({ page: " 2 ", page_size: " 15 " });
    assert.equal(parsed.page, 2);
    assert.equal(parsed.page_size, 15);
  });

  it("uses the last value when a query key is repeated", () => {
    const parsed = parsePagination({ page: ["1", "4"], page_size: ["10", "20"] });
    assert.equal(parsed.page, 4);
    assert.equal(parsed.page_size, 20);
    assert.equal(parsed.skip, 60);
  });

  it("throws on non-numeric page or page_size like Django int()", () => {
    assert.throws(() => parsePagination({ page: "abc" }), InvalidPaginationError);
    assert.throws(() => parsePagination({ page_size: "10.5" }), InvalidPaginationError);
    assert.throws(() => parsePagination({ page: "" }), InvalidPaginationError);
  });
});

describe("parseQueryInt", () => {
  it("returns the default when the value is missing", () => {
    assert.equal(parseQueryInt(undefined, 7), 7);
    assert.equal(parseQueryInt(null, 7), 7);
  });

  it("accepts a signed integer string", () => {
    assert.equal(parseQueryInt("+8", 1), 8);
    assert.equal(parseQueryInt("-2", 1), -2);
  });
});

describe("buildPaginationMeta", () => {
  it("keeps total_pages at least 1 when total is 0", () => {
    const meta = buildPaginationMeta({ page: 1, page_size: 10 }, 0);
    assert.deepEqual(meta, {
      page: 1,
      page_size: 10,
      total: 0,
      total_pages: 1,
      has_next: false,
      has_previous: false,
    });
  });

  it("computes total_pages with ceil division", () => {
    const meta = buildPaginationMeta({ page: 2, page_size: 10 }, 25);
    assert.equal(meta.total_pages, 3);
    assert.equal(meta.has_next, true);
    assert.equal(meta.has_previous, true);
  });

  it("echoes a page past the last page with empty results", () => {
    const items = ["a", "b", "c"];
    const { results, pagination } = paginateItems(items, { page: "9", page_size: "10" });
    assert.deepEqual(results, []);
    assert.equal(pagination.page, 9);
    assert.equal(pagination.total, 3);
    assert.equal(pagination.total_pages, 1);
    assert.equal(pagination.has_next, false);
    assert.equal(pagination.has_previous, true);
  });

  it("slices the requested window", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const { results, pagination } = paginateItems(items, { page: "2", page_size: "5" });
    assert.deepEqual(results, [6, 7, 8, 9, 10]);
    assert.equal(pagination.page, 2);
    assert.equal(pagination.page_size, 5);
    assert.equal(pagination.total, 11);
    assert.equal(pagination.total_pages, 3);
    assert.equal(pagination.has_next, true);
    assert.equal(pagination.has_previous, true);
  });

  it("includes the snake_case pagination keys required by the frontend", () => {
    const meta = buildPaginationMeta({ page: 1, page_size: 10 }, 0);
    assert.deepEqual(Object.keys(meta).sort(), [
      "has_next",
      "has_previous",
      "page",
      "page_size",
      "total",
      "total_pages",
    ]);
  });
});
