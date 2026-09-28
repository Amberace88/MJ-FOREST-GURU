import { describe, expect, it } from "vitest";
import { computeProjectFinance, type FinanceProject, type FinanceRaw } from "./project-finance";

const base: FinanceProject = {
  id: "p1", code: "LV-1", name: "Test", status: "active", start_date: "2026-08-01", expected_end_date: "2026-10-31", actual_end_date: null,
  contract_type: "per_unit", contract_price: 15, contract_currency: "EUR", contract_unit: "m3", expected_volume: 2000, budget_hours: 400, budget_cost: 20000,
};

function raw(partial: Partial<FinanceRaw> = {}): FinanceRaw {
  return {
    production: [{ date: "2026-09-20", quantity: 1000, unit: "m3" }, { date: "2026-09-20", quantity: 5, unit: "loads" }],
    work: [{ employeeId: "e1", date: "2026-09-20T06:00:00Z", netHours: 100 }, { employeeId: "e2", date: "2026-09-21T06:00:00Z", netHours: 50 }],
    rates: new Map([["e1", { rate: 20, currency: "EUR" }]]),
    fuel: [{ date: "2026-09-20T10:00:00Z", litres: 1000, amount: 1500, currency: "EUR" }, { date: "2026-09-20T10:00:00Z", litres: 100, amount: 2000, currency: "SEK" }],
    expenses: [{ date: "2026-09-10", amount: 500, currency: "EUR" }],
    repairs: [{ date: "2026-09-15T00:00:00Z", amount: 1000, currency: "EUR" }],
    ...partial,
  };
}

describe("project finance", () => {
  it("per-unit contract: revenue, costs per currency, margin, budget", () => {
    const f = computeProjectFinance(base, raw(), "2026-09-28");
    expect(f.volume).toBe(1000);
    expect(f.revenue).toBe(15000);
    expect(f.costs).toEqual({ labour: 2000, fuel: 1500, expenses: 500, repairs: 1000 });
    expect(f.totalCost).toBe(5000);
    expect(f.otherCurrencies).toEqual({ SEK: 2000 });
    expect(f.unratedHours).toBe(50);
    expect(f.marginPct).toBeCloseTo(66.667, 2);
    expect(f.costPerM3).toBe(5);
    expect(f.progress).toBe(0.5);
    expect(f.budget.hoursPct).toBeCloseTo(37.5);
    expect(f.budget.costPct).toBe(25);
    expect(f.verdict).toBe("profit");
    // all activity is recent → remaining 1000 m³ at 5 €/m³
    expect(f.forecast?.cost).toBeCloseTo(10000);
    expect(f.forecast?.revenue).toBe(30000);
    expect(f.forecast?.finishDate).toBe("2026-10-28");
  });

  it("labour hidden without salary permission; fixed price uses progress", () => {
    const f = computeProjectFinance({ ...base, contract_type: "fixed", contract_price: 10000 }, raw({ rates: null }), "2026-09-28");
    expect(f.costs.labour).toBeNull();
    expect(f.labourKnown).toBe(false);
    expect(f.totalCost).toBe(3000);
    expect(f.revenue).toBe(5000);
    expect(f.marginPct).toBe(40);
  });

  it("hourly contract and loss verdict; no contract → unknown", () => {
    const f = computeProjectFinance({ ...base, contract_type: "hourly", contract_price: 20 }, raw(), "2026-09-28");
    expect(f.revenue).toBe(3000);
    expect(f.verdict).toBe("loss");
    const none = computeProjectFinance({ ...base, contract_type: null, contract_price: null }, raw(), "2026-09-28");
    expect(none.hasContract).toBe(false);
    expect(none.revenue).toBeNull();
    expect(none.verdict).toBe("unknown");
    expect(none.forecast).toBeNull();
  });

  it("time-based progress when no expected volume", () => {
    const f = computeProjectFinance({ ...base, contract_type: "fixed", contract_price: 9200, expected_volume: null }, raw(), "2026-09-16");
    // 46 of 91 days
    expect(f.progressMethod).toBe("time");
    expect(f.progress).toBeCloseTo(46 / 91, 4);
  });
});
