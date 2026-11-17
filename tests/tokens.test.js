import { describe, expect, it } from "vitest";
import { parseColorTokens } from "../src/core/tokens.js";

describe("parseColorTokens", () => {
  it("@theme 안의 --color-* 변수를 색 값 → 토큰 표로 만든다", () => {
    const css = `
      @theme {
        --color-primary-500: #3B82F6;
        --color-surface: #ffffff;
      }
    `;
    expect(parseColorTokens(css)).toEqual(
      new Map([
        ["#3b82f6", ["--color-primary-500"]],
        ["#ffffff", ["--color-surface"]],
      ]),
    );
  });

  it("3자리 hex를 6자리로 펼쳐서 같은 색으로 본다", () => {
    const css = `@theme { --color-white: #FFF; }`;
    expect(parseColorTokens(css).get("#ffffff")).toEqual(["--color-white"]);
  });

  it("값이 같은 토큰이 여러 개면 모두 담는다", () => {
    const css = `@theme { --color-white: #fff; --color-surface: #ffffff; }`;
    expect(parseColorTokens(css).get("#ffffff")).toEqual([
      "--color-white",
      "--color-surface",
    ]);
  });

  it("색이 아닌 변수와 hex가 아닌 값은 건너뛴다", () => {
    const css = `
      @theme {
        --spacing: 0.25rem;
        --radius-md: 6px;
        --color-brand: oklch(0.6 0.2 250);
        /* --color-old: #000000; */
      }
    `;
    expect(parseColorTokens(css).size).toBe(0);
  });
});
