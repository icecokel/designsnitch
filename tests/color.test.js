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

  it.each(["rgb(var(--x))", "reddish", "var(--color-a)", "rgb(1 2)", "#12345"])("색으로 읽을 수 없는 %s 은 null 이다", (value) => {
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

describe("이름으로 적은 색과 그 밖의 표기", () => {
  it.each([
    ["white", "#ffffff"],
    ["RebeccaPurple", "#663399"],
    ["red", "#ff0000"],
  ])("%s → %s", (value, key) => {
    expect(normalizeColor(value)).toBe(key);
  });

  it.each(["transparent", "currentColor", "inherit", "solid", "none"])("%s 은 색 이름이 아니다", (value) => {
    expect(normalizeColor(value)).toBeNull();
  });

  it("hex 로 바꾸지 않는 표기는 같은 표기끼리만 맞춘다", () => {
    expect(normalizeColor("lab(52% 40 -60)")).toBe("lab(52% 40 -60)");
    expect(normalizeColor("LAB(52%  40 -60)")).toBe("lab(52% 40 -60)");
    expect(normalizeColor("color(display-p3 1 0 0)")).toBe("color(display-p3 1 0 0)");
    expect(normalizeColor("hwb(120 0% 0%)")).toBe("hwb(120 0% 0%)");
  });

  it("색 이름은 요청했을 때만 찾는다. 일반 문자열의 단어일 수 있기 때문이다", () => {
    const text = "1px solid red, var(--red) dark-red white-space lch(50% 30 20) Tan";
    expect(findColorValues(text).map((c) => c.text)).toEqual(["lch(50% 30 20)"]);
    expect(findColorValues(text, { named: true }).map((c) => c.text)).toEqual(["red", "lch(50% 30 20)", "Tan"]);
  });
});
