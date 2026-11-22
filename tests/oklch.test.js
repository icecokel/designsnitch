import { describe, expect, it } from "vitest";
import { oklchToHex } from "../src/core/oklch.js";

describe("oklchToHex", () => {
  it.each([
    ["oklch(55.4% 0.046 257.417)", "#62748e"], // slate-500
    ["oklch(51.1% 0.262 276.966)", "#4f39f6"], // indigo-600
    ["oklch(92.9% 0.013 255.508)", "#e2e8f0"], // slate-200
    ["oklch(100% 0 0)", "#ffffff"],
    ["oklch(0 0 0)", "#000000"],
    ["oklch(0.554 0.046 257.417)", "#62748e"], // L 를 소수로 적은 경우
    ["oklch(55.6% 0 none)", "#737373"], // 4.3.5 부터 회색의 색상(hue)을 none 으로 적는다
    ["oklch(55.6% 0 0)", "#737373"], // 4.3.0 까지의 같은 색
  ])("%s → %s", (value, hex) => {
    expect(oklchToHex(value)).toBe(hex);
  });

  it("sRGB 로 나타낼 수 없는 색은 null 이다. hex 로 바꾸면 다른 색이 되기 때문이다", () => {
    expect(oklchToHex("oklch(84.1% 0.238 128.85)")).toBeNull(); // lime-400, 넓은 색역
  });

  it("oklch 가 아니면 null 이다", () => {
    expect(oklchToHex("#fff")).toBeNull();
    expect(oklchToHex("oklch(var(--x))")).toBeNull();
  });
});
