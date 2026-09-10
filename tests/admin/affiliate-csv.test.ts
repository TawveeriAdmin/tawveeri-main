// tests/admin/affiliate-csv.test.ts — Affiliate Reconciliation CSV import (ADR-213).
import { parseCsv, normalizeRow, sha256, type ColumnMapping } from "../../src/lib/admin/affiliate-csv";

describe("parseCsv", () => {
  it("parses plain comma-separated rows with headers", () => {
    const { headers, rows } = parseCsv("Item Name,ASIN,Price\niPhone 16,B0ABC,3999\n");
    expect(headers).toEqual(["Item Name", "ASIN", "Price"]);
    expect(rows).toEqual([{ "Item Name": "iPhone 16", ASIN: "B0ABC", Price: "3999" }]);
  });

  it("handles quoted fields containing commas and escaped quotes", () => {
    const { rows } = parseCsv('Item Name,Price\n"Samsung, 55"" TV",2999\n');
    expect(rows[0]["Item Name"]).toBe('Samsung, 55" TV');
    expect(rows[0].Price).toBe("2999");
  });

  it("strips a UTF-8 BOM and normalizes CRLF line endings", () => {
    const { headers, rows } = parseCsv("﻿A,B\r\n1,2\r\n");
    expect(headers).toEqual(["A", "B"]);
    expect(rows).toEqual([{ A: "1", B: "2" }]);
  });

  it("returns empty headers/rows for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});

describe("normalizeRow", () => {
  const mapping: ColumnMapping = {
    trackingId: "Tracking ID", itemName: "Item Name", asinOrSku: "ASIN",
    orderDate: "Order Date", quantity: "Qty", price: "Price",
    commissionAmount: "Earnings", state: "Status",
  };

  it("maps a well-formed row and normalizes its state via the alias table", () => {
    const row = {
      "Tracking ID": "click123", "Item Name": "iPhone 16", ASIN: "B0ABC",
      "Order Date": "2026-08-01", Qty: "2", Price: "3,999.00", Earnings: "199.95", Status: "Shipped",
    };
    const r = normalizeRow(row, mapping);
    expect(r.rejected).toBe(false);
    expect(r.sub_id).toBe("click123");
    expect(r.quantity).toBe(2);
    expect(r.price).toBe(3999); // punctuation stripped from numeric parsing
    expect(r.commission_amount).toBe(199.95);
    expect(r.state).toBe("SHIPPED");
    expect(r.order_date).toBe("2026-08-01");
  });

  it("rejects a row with neither trackingId nor itemName", () => {
    const r = normalizeRow({ ASIN: "B0ABC" }, mapping);
    expect(r.rejected).toBe(true);
    expect(r.rejectReason).toMatch(/missing/);
  });

  it("defaults to ORDERED when no status is mapped or recognized", () => {
    const r = normalizeRow({ "Item Name": "Laptop" }, mapping);
    expect(r.state).toBe("ORDERED");
  });

  it("never fabricates a numeric field it can't parse", () => {
    const r = normalizeRow({ "Item Name": "x", Qty: "", Price: "n/a" }, mapping);
    expect(r.quantity).toBeNull();
    expect(r.price).toBeNull();
  });
});

describe("sha256", () => {
  it("is deterministic and content-sensitive (backs idempotent re-upload detection)", () => {
    expect(sha256("a")).toBe(sha256("a"));
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});

// Affiliate Money Proof mission (2026-09-10), §6/§10 — currency was never populated at all
// (affiliate_conversions.currency stayed null on every import); both real merchants in
// scope (Amazon.sa, Noon) report in SAR natively, so that's the honest default, not a
// fabricated conversion.
describe("normalizeRow — currency handling", () => {
  const mapping: ColumnMapping = {
    trackingId: "Tracking ID", itemName: "Item Name", price: "Price", commissionAmount: "Earnings",
  };

  it("defaults to SAR when no currency column is mapped", () => {
    const r = normalizeRow({ "Item Name": "x", Price: "100" }, mapping);
    expect(r.currency).toBe("SAR");
  });

  it("uses the mapped currency column when provided, uppercased", () => {
    const withCurrency: ColumnMapping = { ...mapping, currency: "Currency" };
    const r = normalizeRow({ "Item Name": "x", Price: "100", Currency: "usd" }, withCurrency);
    expect(r.currency).toBe("USD");
  });

  it("a rejected row still carries a currency value, never undefined", () => {
    const r = normalizeRow({}, mapping);
    expect(r.currency).toBe("SAR");
  });
});

// Timezone-safety fix: the previous implementation round-tripped a date-only value through
// JS's local-timezone Date parsing then toISOString() (UTC) — a mismatch that can shift the
// calendar date by a day. An ISO-shaped input is now used verbatim (already covered by the
// "maps a well-formed row" test above); this covers the non-ISO fallback path explicitly.
describe("normalizeRow — date parsing is timezone-safe", () => {
  const mapping: ColumnMapping = { itemName: "Item Name", orderDate: "Order Date" };

  it("an ISO-shaped date (with or without a time component) is used verbatim, never shifted by a day", () => {
    expect(normalizeRow({ "Item Name": "x", "Order Date": "2026-09-15" }, mapping).order_date).toBe("2026-09-15");
    expect(normalizeRow({ "Item Name": "x", "Order Date": "2026-09-15T23:59:00Z" }, mapping).order_date).toBe("2026-09-15");
  });

  it("a non-ISO date format still parses to a real calendar date, not null", () => {
    const r = normalizeRow({ "Item Name": "x", "Order Date": "September 15, 2026" }, mapping);
    expect(r.order_date).toBe("2026-09-15");
  });

  it("an unparseable date returns null, never a fabricated date", () => {
    const r = normalizeRow({ "Item Name": "x", "Order Date": "not a date" }, mapping);
    expect(r.order_date).toBeNull();
  });

  it("a missing date column returns null", () => {
    const r = normalizeRow({ "Item Name": "x" }, mapping);
    expect(r.order_date).toBeNull();
  });
});
