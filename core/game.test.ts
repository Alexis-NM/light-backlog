import { describe, expect, test } from "bun:test";
import { changeTime } from "./game";

describe("changeTime", () => {
  test("is now for something new", () => {
    expect(changeTime(5000)).toBe(5000);
  });

  test("is now when the clock is ahead of the version replaced", () => {
    expect(changeTime(5000, { updatedAt: 4000 })).toBe(5000);
  });

  test("comes right after the version replaced when the clock is behind", () => {
    expect(changeTime(5000, { updatedAt: 6000 })).toBe(6001);
    expect(changeTime(5000, { updatedAt: 5000 })).toBe(5001);
  });
});
