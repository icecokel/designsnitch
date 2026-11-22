import { describe, expect, it } from "vitest";
import { findColorValues, normalizeColor } from "../src/core/color.js";

describe("normalizeColor", () => {
  it.each([
    ["#3B82F6", "#3b82f6"],
    ["#fff", "#ffffff"],
    ["#3B82F6FF", "#3b82f6"], // 알파가 100% 면 같은 색이다
    ["#ffff", "#ffffff"],
    ["rgb(59, 130, 246)", "#3b82f6"],
    ["rgb(59 130 246)", "#3b82f6"],
    ["rgb(59_130_246)", "#3b82f6"], // Tailwind 임의 값은 공백 대신 _ 를 쓴다
    ["rgba(59, 130, 246, 1)", "#3b82f6"],
    ["rgb(59 130 246 / 100%)", "#3b82f6"],
    ["rgb(100% 0% 0%)", "#ff0000"],
    ["RGB(59,130,246)", "#3b82f6"],
    ["hsl(217, 91%, 60%)", "#3c83f6"],
    ["hsl(217 91% 60%)", "#3c83f6"],
    ["hsl(217deg 91% 60%)", "#3c83f6"],
    ["hsl(0 0% 100%)", "#ffffff"],
    ["hsla(0, 100%, 50%, 1)", "#ff0000"],
    ["oklch(55.4% 0.046 257.417)", "#62748e"],
    ["oklch(55.4%_0.046_257.417)", "#62748e"],
  ])("%s → %s", (value, key) => {
    expect(normalizeColor(value)).toBe(key);
  });

  it("sRGB 밖의 oklch 는 표기를 맞춘 oklch 로 비교한다", () => {
    expect(normalizeColor("oklch(84.1% 0.238 128.85)")).toBe("oklch(0.841 0.238 128.85)");
    expect(normalizeColor("oklch(0.841 0.2380 128.850)")).toBe("oklch(0.841 0.238 128.85)");
  });

  it.each(["#3B82F680", "#fff8", "rgba(0, 0, 0, 0.5)", "rgb(0 0 0 / 50%)", "hsl(0 0% 0% / 0.2)", "oklch(50% 0.1 20 / 0.5)"])(
    "반투명한 색 %s 은 null 이다",
    (value) => {
      expect(normalizeColor(value)).toBeNull();
    },
  );

  it.each(["rgb(var(--x))", "red", "var(--color-a)", "rgb(1 2)", "#12345"])("색으로 읽을 수 없는 %s 은 null 이다", (value) => {
    expect(normalizeColor(value)).toBeNull();
  });
});

describe("findColorValues", () => {
  it("문자열에서 hex 와 색 함수를 찾는다", () => {
    expect(findColorValues("1px solid #fff, rgb(1, 2, 3) hsl(0 0% 0% / 0.5)").map(({ index, text }) => [index, text])).toEqual([
      [10, "#fff"],
      [16, "rgb(1, 2, 3)"],
      [29, "hsl(0 0% 0% / 0.5)"],
    ]);
  });

  it("색이 아닌 것은 찾지 않는다", () => {
    expect(findColorValues("a#top &#39; rgb(var(--x)) my-rgb(1,2,3) #12345 url(x)")).toEqual([]);
  });
});
