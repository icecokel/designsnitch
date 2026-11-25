import { describe, expect, it } from "vitest";
import { findArbitrarySizes, findCssSizes, findLengths, matchSize, parseLength, parseSizeTokens, sizePropertyKind, sizeTokenClass } from "../src/core/size.js";

describe("parseLength", () => {
  it("px 와 rem 을 읽고 px 로 환산한다", () => {
    expect(parseLength("8px")).toEqual({ text: "8px", px: 8, unit: "px" });
    expect(parseLength(".50rem")).toEqual({ text: "0.5rem", px: 8, unit: "rem" });
  });

  it("0, 알약 모양 값, 다른 단위는 읽지 않는다", () => {
    for (const value of ["0px", "9999px", "50%", "1em", "auto", "8"]) expect(parseLength(value)).toBeNull();
  });
});

describe("findLengths", () => {
  it("그대로 적은 길이만 찾고 함수 안은 보지 않는다", () => {
    expect(findLengths("8px 8px 0 0").map((f) => f.index)).toEqual([0, 4]);
    expect(findLengths("calc(100% - 8px) var(--x, 4px) clamp(1rem, 2vw, 2rem)")).toEqual([]);
  });
});

describe("findArbitrarySizes", () => {
  it("radius, 글자 크기, 간격 클래스를 종류와 함께 찾는다", () => {
    expect(findArbitrarySizes("rounded-t-[8px] text-[14px] hover:px-[13px] -mt-[2px]")).toEqual([
      { index: 0, text: "rounded-t-[8px]", utility: "rounded-t", value: "8px", kind: "radius" },
      { index: 16, text: "text-[14px]", utility: "text", value: "14px", kind: "fontSize" },
      { index: 34, text: "px-[13px]", utility: "px", value: "13px", kind: "spacing" },
      { index: 45, text: "mt-[2px]", utility: "mt", value: "2px", kind: "spacing" },
    ]);
  });

  it("색과 다른 임의 값은 잡지 않는다", () => {
    expect(findArbitrarySizes("text-[#fff] w-[13px] rounded-[9999px] rounded-[50%] text-[length:var(--x)]")).toEqual([]);
  });
});

describe("findCssSizes", () => {
  it("선언과 @apply 의 크기를 위치와 함께 찾는다", () => {
    const css = ".a {\n  border-radius: 8px 8px 0 0;\n  font-size: 14px;\n  padding: calc(1px + 2px) 12px;\n  @apply rounded-[10px];\n  width: 20px;\n}\n";
    expect(findCssSizes(css).map(({ line, column, value, kind, prop, utility }) => [line, column, value, kind, prop ?? utility])).toEqual([
      [2, 18, "8px", "radius", "border-radius"],
      [2, 22, "8px", "radius", "border-radius"],
      [3, 14, "14px", "fontSize", "font-size"],
      [4, 28, "12px", "spacing", "padding"],
      [5, 10, "10px", "radius", "rounded"],
    ]);
  });
});

describe("sizePropertyKind", () => {
  it("CSS 이름과 스타일 객체 이름을 모두 받는다", () => {
    expect(sizePropertyKind("borderTopLeftRadius")).toBe("radius");
    expect(sizePropertyKind("fontSize")).toBe("fontSize");
    expect(sizePropertyKind("row-gap")).toBe("spacing");
    expect(sizePropertyKind("width")).toBeNull();
  });
});

describe("토큰과 맞추기", () => {
  const tokens = parseSizeTokens(`
    @theme {
      --radius-lg: 0.5rem;
      --radius-card: 12px;
      --text-sm: 0.875rem;
      --text-sm--line-height: 1.25rem;
      --text-shadow-sm: 1px;
      --text-body: 14px;
    }
    @media (min-width: 1px) { :root { --radius-wide: 20px; } }
    .dark { --radius-dark: 4px; }
  `);

  it("전역에서 선언된 길이 토큰만 읽는다", () => {
    expect(tokens.radius.count).toBe(2);
    expect(tokens.fontSize.count).toBe(2);
  });

  it("같은 단위의 같은 값은 바꿔도 화면이 같다", () => {
    expect(matchSize("radius", tokens.radius, "12px", true)).toEqual({ names: ["--radius-card"], messageId: "useToken" });
    expect(matchSize("fontSize", tokens.fontSize, "14px", false)).toEqual({ names: ["--text-body"], messageId: "useToken" });
  });

  it("단위를 환산해야 같으면 사람이 정한다", () => {
    expect(matchSize("radius", tokens.radius, "8px", false)).toEqual({ names: ["--radius-lg"], messageId: "useTokenUnit" });
  });

  it("글자 크기 클래스는 줄 높이가 달라질 수 있어 사람이 정한다", () => {
    expect(matchSize("fontSize", tokens.fontSize, "14px", true)).toEqual({ names: ["--text-body"], messageId: "useTokenLineHeight" });
  });

  it("맞는 토큰이 없으면 unknown, 그 종류의 토큰이 아예 없으면 판정하지 않는다", () => {
    expect(matchSize("radius", tokens.radius, "7px", true)).toEqual({ names: [], messageId: "unknown" });
    expect(matchSize("radius", parseSizeTokens("@theme {}").radius, "7px", true)).toBeNull();
  });

  it("토큰 이름으로 클래스를 만든다", () => {
    expect(sizeTokenClass("radius", "rounded-t", "--radius-lg")).toBe("rounded-t-lg");
    expect(sizeTokenClass("fontSize", "text", "--text-sm")).toBe("text-sm");
  });
});
