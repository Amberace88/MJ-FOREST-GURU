import { describe, expect, it } from "vitest";
import {
  fuelCost, huberVolume, jobProfitability, labourCost, logsVolume, machineHourlyCost, parseNum, solidToStacked, stackedToSolid, truckLoads, verdictFor,
} from "./calc";

describe("calculators", () => {
  it("parses Latvian-style decimals", () => {
    expect(parseNum("1,5")).toBe(1.5);
    expect(parseNum("1 200,25")).toBe(1200.25);
    expect(parseNum("")).toBe(0);
    expect(parseNum("abc")).toBe(0);
  });

  it("Huber log volume", () => {
    // d = 30 cm, L = 5 m → π/4 · 0.09 · 5 = 0.35343 m³
    expect(huberVolume(30, 5)).toBeCloseTo(0.353429, 5);
    expect(huberVolume(0, 5)).toBe(0);
    const r = logsVolume([{ diameter: 30, length: 5, quantity: 10 }, { diameter: 20, length: 4, quantity: 5 }]);
    expect(r.total).toBeCloseTo(3.53429 + 0.628319, 4);
    expect(r.pieces).toBe(15);
  });

  it("stacked ↔ solid and truck loads", () => {
    expect(stackedToSolid(100, 0.65)).toBeCloseTo(65);
    expect(solidToStacked(65, 0.65)).toBeCloseTo(100);
    expect(truckLoads(95, 40)).toEqual({ loads: 3, full: 2, remainder: 15 });
    expect(truckLoads(80, 40).loads).toBe(2);
  });

  it("job profitability, margin and break-even", () => {
    const r = jobProfitability({
      volume: 1000, price: 15, harvesterHours: 50, harvesterRate: 60, forwarderHours: 40, forwarderRate: 40,
      fuelLitres: 1000, fuelPrice: 1.5, transportPerM3: 1, labourHours: 100, labourRate: 15, other: 500, targetMarginPct: 20,
    });
    expect(r.revenue).toBe(15000);
    expect(r.totalCost).toBe(3000 + 1600 + 1500 + 1000 + 1500 + 500);
    expect(r.profit).toBe(15000 - 9100);
    expect(r.marginPct).toBeCloseTo(39.333, 2);
    expect(r.breakEvenPrice).toBeCloseTo(9.1);
    expect(r.targetPrice).toBeCloseTo(9.1 / 0.8);
    expect(r.verdict).toBe("profit");
    expect(verdictFor(5)).toBe("thin");
    expect(verdictFor(-1)).toBe("loss");
    expect(verdictFor(null)).toBe("unknown");
  });

  it("machine hourly cost", () => {
    const r = machineHourlyCost({
      purchasePrice: 400000, residualPct: 25, years: 5, hoursPerYear: 2000, interestPct: 5, insuranceTaxPerYear: 4000,
      maintenancePerHour: 10, fuelLph: 15, fuelPrice: 1.5, operatorPerHour: 20, markupPct: 10,
    });
    expect(r.parts.depreciation).toBeCloseTo(300000 / 10000);
    expect(r.parts.interest).toBeCloseTo(((400000 + 100000) / 2) * 0.05 / 2000);
    expect(r.parts.insurance).toBe(2);
    expect(r.parts.fuel).toBe(22.5);
    expect(r.total).toBeCloseTo(30 + 6.25 + 2 + 10 + 22.5 + 20);
    expect(r.suggestedRate).toBeCloseTo(r.total * 1.1);
    expect(r.machineOnly).toBeCloseTo(30 + 6.25 + 2 + 10);
  });

  it("fuel and labour", () => {
    const f = fuelCost({ price: 1.5, lph: 12, hours: 10, lpm3: 1.2, m3: 100, hoursPerDay: 10, daysPerMonth: 20, machines: 2 });
    expect(f.byHours.cost).toBe(180);
    expect(f.byVolume.litres).toBeCloseTo(120);
    expect(f.monthly.litres).toBe(4800);
    const l = labourCost({ hours: 160, rate: 10, overtimeHours: 10, overtimeMultiplier: 1.5, socialTaxPct: 23.59 });
    expect(l.gross).toBe(1750);
    expect(l.employerCost).toBeCloseTo(1750 * 1.2359);
    expect(l.costPerHour).toBeCloseTo((1750 * 1.2359) / 170);
  });
});
