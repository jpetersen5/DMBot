import { describe, it, expect } from "vitest";
import { splitCharters } from "./charters.ts";

describe("splitCharters", () => {
  it.each([
    ["TDC & Sang Duta", ["TDC", "Sang Duta"]],
    ["a, b / c", ["a", "b", "c"]],
    ["Harmonix - Onyxite + Xane60 and Miscellany", ["Harmonix", "Onyxite", "Xane60", "Miscellany"]],
    ["  solo  ", ["solo"]],
    ["", []],
  ])("splits %j", (input, expected) => {
    expect(splitCharters(input)).toEqual(expected);
  });

  it("strips colour and other markup tags", () => {
    expect(splitCharters("<color=#FF0000>Xane60</color> & <b>Rh</b>")).toEqual(["Xane60", "Rh"]);
  });

  it("does not split on delimiters inside a colour tag", () => {
    expect(splitCharters("<color=#a/b>Name</color>")).toEqual(["Name"]);
  });
});
