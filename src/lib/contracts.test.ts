import { describe, expect, it } from "vitest";
import { contractValue, timeProgress, upcomingDates } from "./contracts";

describe("contractValue", () => {
  it("prefers the agreed total", () => {
    expect(contractValue({ total_value: 1000, unit_price: 5, volume_m3: 10, area_ha: null, pricing_model: "per_m3" })).toEqual({ value: 1000, estimated: false });
  });
  it("estimates from unit price × volume / area", () => {
    expect(contractValue({ total_value: null, unit_price: 12.5, volume_m3: 3000, area_ha: null, pricing_model: "per_m3" })).toEqual({ value: 37500, estimated: true });
    expect(contractValue({ total_value: null, unit_price: 400, volume_m3: null, area_ha: 2.5, pricing_model: "per_ha" })).toEqual({ value: 1000, estimated: true });
    expect(contractValue({ total_value: null, unit_price: 40, volume_m3: null, area_ha: null, pricing_model: "per_hour" }).value).toBeNull();
  });
});

describe("timeProgress", () => {
  it("clamps to 0–100", () => {
    expect(timeProgress("2026-01-01", "2026-12-31", "2025-06-01")).toBe(0);
    expect(timeProgress("2026-01-01", "2026-12-31", "2027-06-01")).toBe(100);
    expect(timeProgress("2026-01-01", "2026-12-31", "2026-07-02")).toBeGreaterThan(45);
    expect(timeProgress(null, "2026-12-31", "2026-07-02")).toBeNull();
  });
});

describe("upcomingDates", () => {
  it("lists end, notice and open milestones of live contracts within the horizon", () => {
    const items = upcomingDates(
      [
        { id: "a", title: "A", status: "active", end_date: "2026-10-20", notice_date: "2026-10-05" },
        { id: "b", title: "B", status: "completed", end_date: "2026-10-01", notice_date: null },
        { id: "c", title: "C", status: "active", end_date: "2027-10-01", notice_date: null },
      ],
      [
        { contract_id: "a", title: "Rēķins #1", kind: "invoice", due_date: "2026-10-01", done_at: null, amount: 500 },
        { contract_id: "a", title: "Done", kind: "invoice", due_date: "2026-10-02", done_at: "2026-09-30T10:00:00Z", amount: 1 },
        { contract_id: "b", title: "Closed contract", kind: "payment", due_date: "2026-10-02", done_at: null, amount: 1 },
      ],
      "2026-09-29",
    );
    expect(items.map((i) => `${i.contractId}:${i.kind}:${i.date}`)).toEqual(["a:milestone:2026-10-01", "a:notice:2026-10-05", "a:end:2026-10-20"]);
  });
});
