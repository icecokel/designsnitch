import { describe, expect, it } from "vitest";
import { findArbitraryLengths } from "../src/core/classes.js";
import { matchScale, parseLength } from "../src/core/scale.js";
import { parseScaleTokens } from "../src/core/tokens.js";

const css = `
  @theme {
    --spacing: 0.25rem;
    --radius-sm: 0.25rem;
    --radius-md: 6px;
    --text-sm: 0.875rem;
    --text-sm--line-height: 1.25rem;
    --text-base: 1rem;
  }
`;

describe("parseLength", () => {
  it("px와 rem을 px 숫자로 바꾼다", () => {
    expect(parseLength("16px")).toBe(16);
    expect(parseLength("1rem")).toBe(16);
    expect(parseLength("0.375rem")).toBe(6);
  });

  it("다른 단위와 식은 null", () => {
    expect(parseLength("50%")).toBeNull();
    expect(parseLength("calc(100% - 1rem)")).toBeNull();
    expect(parseLength("#fff")).toBeNull();
  });
});

describe("parseScaleTokens", () => {
  it("간격 단위와 radius, 폰트 크기 토큰을 px로 읽는다", () => {
    expect(parseScaleTokens(css)).toEqual({
      spacingUnit: 4,
      radius: new Map([
        [4, ["--radius-sm"]],
        [6, ["--radius-md"]],
      ]),
      text: new Map([
        [14, ["--text-sm"]],
        [16, ["--text-base"]],
      ]),
    });
  });

  it("--spacing 이 없으면 Tailwind 기본값(0.25rem)을 쓴다", () => {
    expect(parseScaleTokens(`@theme { --color-a: #fff; }`).spacingUnit).toBe(4);
  });
});

describe("findArbitraryLengths", () => {
  it("px, rem 임의 값을 px로 바꿔서 찾고 나머지는 건너뛴다", () => {
    expect(
      findArbitraryLengths("p-[16px] rounded-t-[0.375rem] w-[50%] bg-[#fff]"),
    ).toEqual([
      { index: 0, text: "p-[16px]", utility: "p", px: 16 },
      { index: 9, text: "rounded-t-[0.375rem]", utility: "rounded-t", px: 6 },
    ]);
  });
});

describe("matchScale", () => {
  const scale = parseScaleTokens(css);

  it("간격: 단위의 배수면 그 단계의 클래스를 돌려준다", () => {
    expect(matchScale("p", 16, scale)).toEqual({ kind: "spacing", exact: ["p-4"] });
    expect(matchScale("gap-x", 18, scale)).toEqual({ kind: "spacing", exact: ["gap-x-4.5"] });
    expect(matchScale("mt", 1, scale)).toEqual({ kind: "spacing", exact: ["mt-px"] });
  });

  it("간격: 스케일에 없으면 앞뒤 단계를 돌려준다", () => {
    expect(matchScale("p", 15, scale)).toEqual({
      kind: "spacing",
      nearest: [
        { className: "p-3.5", px: 14 },
        { className: "p-4", px: 16 },
      ],
    });
  });

  it("radius: 토큰 값과 같으면 그 토큰의 클래스를 돌려준다", () => {
    expect(matchScale("rounded", 6, scale)).toEqual({ kind: "radius", exact: ["rounded-md"] });
  });

  it("radius: 토큰에 없으면 앞뒤 토큰을 돌려준다", () => {
    expect(matchScale("rounded-t", 5, scale)).toEqual({
      kind: "radius",
      nearest: [
        { className: "rounded-t-sm", px: 4 },
        { className: "rounded-t-md", px: 6 },
      ],
    });
    expect(matchScale("rounded", 100, scale).nearest).toEqual([
      { className: "rounded-md", px: 6 },
    ]);
  });

  it("폰트 크기: text 유틸리티를 토큰과 비교한다", () => {
    expect(matchScale("text", 14, scale)).toEqual({ kind: "text", exact: ["text-sm"] });
    expect(matchScale("text", 13, scale).nearest).toEqual([
      { className: "text-sm", px: 14 },
    ]);
  });

  it("대상이 아닌 유틸리티와, 토큰이 정의되지 않은 종류는 null", () => {
    expect(matchScale("w", 320, scale)).toBeNull();
    const noTokens = parseScaleTokens(`@theme {}`);
    expect(matchScale("rounded", 6, noTokens)).toBeNull();
    expect(matchScale("text", 14, noTokens)).toBeNull();
  });
});
