import { describe, expect, it } from "vitest";
import { formatPhone, isE164, normalizePhone, splitPhone, waLink } from "./phone";

describe("phone", () => {
  it("normalizes", () => {
    expect(normalizePhone(" +371 26-123 456 ")).toBe("+37126123456");
    expect(normalizePhone("0046 70 123 45 67")).toBe("+46701234567");
  });
  it("validates E.164", () => {
    expect(isE164("+371 26123456")).toBe(true);
    expect(isE164("26123456")).toBe(false);
    expect(isE164("+0123")).toBe(false);
  });
  it("splits by dial code", () => {
    expect(splitPhone("+37126123456")).toEqual({ code: "+371", local: "26123456" });
    expect(splitPhone("+3545551234")).toEqual({ code: "+354", local: "5551234" });
    expect(splitPhone("26123456")).toEqual({ code: "+371", local: "26123456" });
  });
  it("formats and links", () => {
    expect(formatPhone("+37126123456")).toBe("+371 26 123 456");
    expect(waLink("+371 26123456")).toBe("https://wa.me/37126123456");
  });
});
