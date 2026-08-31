import { describe, expect, it } from "vitest";

import {
  isValidRepsValue,
  isValidWeightValue,
  parseRepsValue,
  shouldAcceptRepsInput,
  shouldAcceptWeightInput,
} from "./inputConstraints";

describe("shouldAcceptRepsInput", () => {
  it.each(["", "1", "8", "999"])("accepts %j", (value) => {
    expect(shouldAcceptRepsInput(value)).toBe(true);
  });

  it.each(["0", "001", "1000", "1.5", "-1", "8abc", "８", "あ"])(
    "rejects %j",
    (value) => {
      expect(shouldAcceptRepsInput(value)).toBe(false);
    },
  );
});

describe("shouldAcceptWeightInput", () => {
  it.each(["", "1", "90", "90.", "90.5", "999", "999.9"])("accepts %j", (value) => {
    expect(shouldAcceptWeightInput(value)).toBe(true);
  });

  it.each([
    "0",
    "0.",
    "0.5",
    "001",
    "1000",
    "1000.1",
    "90.55",
    "-90",
    "90kg",
    "９０",
    "あ",
  ])("rejects %j", (value) => {
    expect(shouldAcceptWeightInput(value)).toBe(false);
  });
});

describe("isValidRepsValue", () => {
  it.each(["1", "999", " 8 "])("validates %j as a savable reps value", (value) => {
    expect(isValidRepsValue(value)).toBe(true);
  });

  it.each(["", "0", "1000", "1.5", "8abc", "８"])(
    "rejects %j as a savable reps value",
    (value) => {
      expect(isValidRepsValue(value)).toBe(false);
    },
  );
});

describe("isValidWeightValue", () => {
  it.each(["1", "90", "90.5", "999", "999.9", " 90 "])(
    "validates %j as a savable weight value",
    (value) => {
      expect(isValidWeightValue(value)).toBe(true);
    },
  );

  it.each(["", "0", "0.5", "90.", "1000", "90.55", "-90", "90kg", "９０"])(
    "rejects %j as a savable weight value",
    (value) => {
      expect(isValidWeightValue(value)).toBe(false);
    },
  );
});

describe("parseRepsValue", () => {
  it("returns the reps number when the value is valid", () => {
    expect(parseRepsValue("12")).toBe(12);
  });

  it("returns 0 when the value is invalid or empty", () => {
    expect(parseRepsValue("")).toBe(0);
    expect(parseRepsValue("1.5")).toBe(0);
  });
});
