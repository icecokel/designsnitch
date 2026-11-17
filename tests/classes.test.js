import { describe, expect, it } from "vitest";
import { findArbitraryColors, tokenToClass } from "../src/core/classes.js";

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
