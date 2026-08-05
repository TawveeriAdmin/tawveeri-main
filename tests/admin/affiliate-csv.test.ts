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
