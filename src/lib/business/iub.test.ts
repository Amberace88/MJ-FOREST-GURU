import { describe, expect, it } from "vitest";
import { parseIubDay, parseIubNotice, rigaDateTime } from "./iub";
import { classifyTender } from "./tender-classify";

const base = (over: Record<string, unknown> = {}) => ({
  name: "Mežizstrādes pakalpojumi Ogres novadā",
  cpvType: "77210000-5",
  additionalCpvType: ["77211100-8"],
  formType: "competition",
  noticeType: "pil-contract",
  identifier: "abc",
  procurementProject: { description: "Mežizstrādes pakalpojumi Ogres novadā", mainNatureType: "services", procurementIdentifier: "ONP 2026/12" },
  tenderingProcess: { procedureType: "open", documentsURL: "https://www.eis.gov.lv/EKEIS/Supplier/Procurement/182780" },
  tenderingTerms: {},
  organizationData: { name: "Ogres novada pašvaldība", identifier: "90000024332", city: "Ogre", nutsCode: "LV00B", defaultContactPoint: { electronicMail: "iepirkumi@ogresnovads.lv", telephone: "+37165000000" } },
  lots: [{
    additionalInformation: { estimatedValue: "25750.00" },
    duration: { termSelection: "duration", durationPeriod: 12 },
    tenderingProcess: { deadlineReceiptTendersEndDate: "12/10/2026", deadlineReceiptTendersEndTime: "10:00" },
  }],
  ...over,
});

describe("classifyTender", () => {
  it("scores forestry CPV codes and keywords", () => {
    expect(classifyTender({ title: "Mežizstrāde", cpv: "77210000" })).toMatchObject({ category: "harvesting" });
    expect(classifyTender({ title: "Bīstamo koku nozāģēšana", cpv: "77000000" }).category).toBe("trees");
    expect(classifyTender({ title: "Jaunaudžu kopšana" }).category).toBe("planting");
    expect(classifyTender({ title: "Kurināmās malkas piegāde", cpv: "03413000" }).category).toBe("timber");
  });
  it("ignores unrelated notices and street names", () => {
    expect(classifyTender({ title: "Meža ielas pārbūve", cpv: "45233000" }).score).toBeLessThan(3);
    expect(classifyTender({ title: "Datortehnikas piegāde", cpv: "30200000" }).score).toBe(0);
  });
});

describe("rigaDateTime", () => {
  it("converts Riga local time (summer and winter)", () => {
    expect(rigaDateTime("12/10/2026", "10:00")).toBe("2026-10-12T07:00:00.000Z");
    expect(rigaDateTime("12/01/2027", "10:00")).toBe("2027-01-12T08:00:00.000Z");
    expect(rigaDateTime("bad", "10:00")).toBeNull();
  });
});

describe("parseIubNotice", () => {
  it("maps a competition notice", () => {
    const r = parseIubNotice(base(), "2026-09-25")!;
    expect(r).toMatchObject({
      id: "iub:182780:competition", source: "iub", country: "LV", stage: "competition", category: "harvesting",
      buyer_name: "Ogres novada pašvaldība", buyer_email: "iepirkumi@ogresnovads.lv", reference: "ONP 2026/12",
      estimated_value: 25750, currency: "EUR", duration_months: 12, deadline: "2026-10-12T07:00:00.000Z",
      url: "https://www.eis.gov.lv/EKEIS/Supplier/Procurement/182780", published_on: "2026-09-25", description: null,
    });
    expect(r.cpv).toBe("77210000");
  });
  it("accepts lots as an object map", () => {
    const r = parseIubNotice(base({ lots: { a: base().lots[0] } }), "2026-09-25")!;
    expect(r.estimated_value).toBe(25750);
  });
  it("skips irrelevant or execution notices", () => {
    expect(parseIubNotice(base({ formType: "execution" }), "2026-09-25")).toBeNull();
    expect(parseIubNotice(base({ name: "Apdrošināšana", cpvType: "66510000-8", additionalCpvType: [], procurementProject: { description: "Apdrošināšana" } }), "2026-09-25")).toBeNull();
  });
  it("keeps the latest version of a notice in a day file", () => {
    const rows = parseIubDay([base(), base({ name: "Mežizstrādes pakalpojumi (grozīts)" })], "2026-09-25");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toContain("grozīts");
  });
});

describe("negative keywords", () => {
  it("drops wood pellet supply", () => {
    expect(classifyTender({ title: "Kokskaidu granulu piegāde", cpv: "09111400" }).score).toBeLessThan(3);
    expect(classifyTender({ title: "Kurināmās šķeldas iegāde", cpv: "09111400" }).score).toBeGreaterThanOrEqual(3);
  });
});
