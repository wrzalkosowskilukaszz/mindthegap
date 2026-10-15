import { describe, expect, it } from "vitest";
import { classifyCandidate } from "./company-discovery.ts";

describe("Wikidata candidate filter", () => {
  it.each([
    ["Komenda Stołeczna Policji", null, "police"],
    ["Uniwersytet Wrocławski", null, "public university"],
    ["Caritas Archidiecezji Warszawskiej", "social services", "charity"],
    ["Moose Centrum Języków Obcych", "language school", "business"],
    ["Stowarzyszenie „Wspólnota Polska”", "international activities", "association"],
  ])("skips %s (not a company that buys training by email)", (name, industry, types) => {
    expect(classifyCandidate(name, industry, types).nonBusiness).toBe(true);
  });

  it.each([
    ["Neuca", "wholesale", "public company", "retail_consumer"],
    ["Stocznia Gdańska", "shipbuilding", "business", "manufacturing_industrial"],
    ["Tele-Fonika Kable", null, "business", "manufacturing_industrial"],
    ["Volkswagen Motor Polska", null, "subsidiary", "manufacturing_industrial"],
  ])("keeps %s and infers its sector", (name, industry, types, sector) => {
    expect(classifyCandidate(name, industry, types)).toEqual({ nonBusiness: false, sector });
  });
});
