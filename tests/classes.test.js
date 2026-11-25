import { describe, expect, it } from "vitest";
import { findArbitraryColors, findPaletteClasses, tokenToClass } from "../src/core/classes.js";

describe("findArbitraryColors", () => {
  it("임의 값 색 클래스를 위치와 함께 찾는다", () => {
    expect(findArbitraryColors("px-4 bg-[#3B82F6] rounded")).toEqual([
      { index: 5, text: "bg-[#3B82F6]", utility: "bg", value: "#3B82F6" },
    ]);
  });

  it("한 문자열에 여러 개 있으면 모두 찾는다", () => {
    const found = findArbitraryColors("text-[#fff] border-[#000000]");
    expect(found.map((f) => f.text)).toEqual(["text-[#fff]", "border-[#000000]"]);
  });

  it("variant가 붙어 있어도 유틸리티 부분만 잡는다", () => {
    expect(findArbitraryColors("hover:bg-[#3B82F6]")).toEqual([
      { index: 6, text: "bg-[#3B82F6]", utility: "bg", value: "#3B82F6" },
    ]);
  });

  it("이름에 하이픈이 있는 유틸리티도 잡는다", () => {
    expect(findArbitraryColors("ring-offset-[#fff]")[0].utility).toBe("ring-offset");
  });

  it("타입 힌트 color: 를 붙인 임의 값도 잡는다", () => {
    expect(findArbitraryColors("p-2 bg-[color:#3B82F6]")).toEqual([
      { index: 4, text: "bg-[color:#3B82F6]", utility: "bg", value: "#3B82F6" },
    ]);
    expect(findArbitraryColors("text-[color:rgb(59,130,246)]")[0].value).toBe("rgb(59,130,246)");
  });

  it("색이 아닌 타입 힌트는 잡지 않는다", () => {
    expect(findArbitraryColors("text-[length:14px] bg-[url:red]")).toEqual([]);
  });

  it("색이 아닌 임의 값과 토큰 클래스는 잡지 않는다", () => {
    expect(findArbitraryColors("p-[15px] w-[calc(100%-1rem)] bg-primary-500")).toEqual([]);
  });
});

describe("tokenToClass", () => {
  it("유틸리티와 토큰 이름으로 클래스를 만든다", () => {
    expect(tokenToClass("bg", "--color-primary-500")).toBe("bg-primary-500");
    expect(tokenToClass("ring-offset", "--color-surface")).toBe("ring-offset-surface");
  });
});

describe("findPaletteClasses", () => {
  it("Tailwind 기본 팔레트 색을 쓴 클래스를 찾는다", () => {
    expect(findPaletteClasses("p-4 bg-blue-500 text-gray-700")).toEqual([
      { index: 4, text: "bg-blue-500", utility: "bg", name: "blue-500" },
      { index: 16, text: "text-gray-700", utility: "text", name: "gray-700" },
    ]);
  });

  it("variant, 하이픈이 있는 유틸리티, 투명도, black과 white를 처리한다", () => {
    const found = findPaletteClasses("hover:border-t-red-50 bg-white/80 text-black ring-offset-slate-950");
    expect(found.map(({ utility, name }) => `${utility} ${name}`)).toEqual([
      "border-t red-50",
      "bg white",
      "text black",
      "ring-offset slate-950",
    ]);
  });

  it("색이 아닌 클래스와 토큰 클래스는 잡지 않는다", () => {
    expect(
      findPaletteClasses("whitespace-nowrap text-sm bg-primary-500 grid-cols-12 bg-[#fff] text-gray-7000"),
    ).toEqual([]);
  });
});
