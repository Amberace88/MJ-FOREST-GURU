import { describe, expect, it } from "vitest";
import { fromTM, localGrid, parseCoordinates, toLKS92, toSWEREF99 } from "./coords";

const riga = { lat: 56.9496, lng: 24.1052 };
const sthlm = { lat: 59.3293, lng: 18.0686 };

describe("transverse mercator", () => {
  it("matches EPSG:3059 (LKS-92) reference", () => {
    const g = toLKS92(riga);
    expect(g.e).toBeCloseTo(506399.31, 0);
    expect(g.n).toBeCloseTo(311780.57, 0);
  });
  it("matches EPSG:3006 (SWEREF 99 TM) reference", () => {
    const g = toSWEREF99(sthlm);
    expect(g.e).toBeCloseTo(674571.87, 0);
    expect(g.n).toBeCloseTo(6580743.01, 0);
  });
  it("round-trips", () => {
    const p = fromTM(311780.57, 506399.31, { lon0: 24, k0: 0.9996, fe: 500000, fn: -6000000 });
    expect(p.lat).toBeCloseTo(riga.lat, 5);
    expect(p.lng).toBeCloseTo(riga.lng, 5);
  });
});

describe("parseCoordinates", () => {
  it("decimal lat,lng", () => expect(parseCoordinates("56.9496, 24.1052")).toMatchObject({ lat: 56.9496, lng: 24.1052, system: "wgs84" }));
  it("decimal with comma decimals and space", () => expect(parseCoordinates("56,9496 24,1052")).toMatchObject({ lat: 56.9496, lng: 24.1052 }));
  it("swapped lng lat", () => expect(parseCoordinates("24.1052 56.9496")).toMatchObject({ lat: 56.9496, lng: 24.1052 }));
  it("DMS", () => {
    const p = parseCoordinates(`56°56'58.6"N 24°6'18.7"E`)!;
    expect(p.lat).toBeCloseTo(56.94961, 4);
    expect(p.lng).toBeCloseTo(24.10519, 4);
  });
  it("degrees + decimal minutes", () => {
    const p = parseCoordinates("N 56 56.976 E 24 6.312")!;
    expect(p.lat).toBeCloseTo(56.9496, 3);
    expect(p.lng).toBeCloseTo(24.1052, 3);
  });
  it("LKS-92 in either order", () => {
    for (const s of ["311781 506399", "X 311781, Y 506399", "506399 311781"]) {
      const p = parseCoordinates(s)!;
      expect(p.system).toBe("lks92");
      expect(p.lat).toBeCloseTo(riga.lat, 3);
      expect(p.lng).toBeCloseTo(riga.lng, 3);
    }
  });
  it("SWEREF 99 TM", () => {
    const p = parseCoordinates("6580743, 674572")!;
    expect(p.system).toBe("sweref99");
    expect(p.lat).toBeCloseTo(sthlm.lat, 3);
  });
  it("addresses are not coordinates", () => {
    expect(parseCoordinates("Brīvības iela 1, Rīga")).toBeNull();
    expect(parseCoordinates("Cēsis")).toBeNull();
  });
  it("local grid label", () => {
    expect(localGrid(riga)?.label).toBe("LKS-92");
    expect(localGrid(sthlm)?.label).toBe("SWEREF 99 TM");
    expect(localGrid({ lat: 64.1, lng: -21.9 })).toBeNull();
  });
});
