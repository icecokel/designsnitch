import { describe, expect, it } from "vitest";
import { parseColorTokenData, parseColorTokens } from "../src/core/tokens.js";

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

  describe("var() 참조", () => {
    it("다른 변수를 가리키는 토큰은 그 변수의 값을 따라가서 읽는다", () => {
      const css = `
        :root { --primary-500: #3B82F6; }
        @theme { --color-primary-500: var(--primary-500); }
      `;
      expect(parseColorTokens(css)).toEqual(new Map([["#3b82f6", ["--color-primary-500"]]]));
    });

    it("토큰이 아닌 변수 자체는 토큰으로 보지 않는다", () => {
      const css = `:root { --primary-500: #3B82F6; }`;
      expect(parseColorTokens(css).size).toBe(0);
    });

    it("여러 단계를 거친 참조도 따라간다", () => {
      const css = `
        :root { --blue: #3B82F6; --brand: var(--blue); }
        @theme { --color-brand: var(--brand); }
      `;
      expect(parseColorTokens(css).get("#3b82f6")).toEqual(["--color-brand"]);
    });

    it("가리키는 변수가 없으면 대체값을 쓰고, 대체값도 없으면 건너뛴다", () => {
      const css = `
        @theme {
          --color-a: var(--missing, #fff);
          --color-b: var(--missing);
        }
      `;
      expect(parseColorTokens(css)).toEqual(new Map([["#ffffff", ["--color-a"]]]));
    });

    it("서로를 가리키는 참조는 건너뛴다", () => {
      const css = `
        :root { --a: var(--b); --b: var(--a); }
        @theme { --color-loop: var(--a); }
      `;
      expect(parseColorTokens(css).size).toBe(0);
    });

    it("테마마다 값이 다르면 모든 값을 그 토큰의 값으로 본다", () => {
      const css = `
        :root { --surface: #ffffff; }
        .dark { --surface: #111827; }
        @theme { --color-surface: var(--surface); }
      `;
      expect(parseColorTokens(css)).toEqual(
        new Map([
          ["#ffffff", ["--color-surface"]],
          ["#111827", ["--color-surface"]],
        ]),
      );
    });

    it("같은 토큰이 같은 값으로 두 번 나와도 한 번만 담는다", () => {
      const css = `
        :root { --white: #fff; }
        @theme { --color-white: var(--white); --color-white: #ffffff; }
      `;
      expect(parseColorTokens(css).get("#ffffff")).toEqual(["--color-white"]);
    });
  });
});

describe("oklch 토큰", () => {
  it("sRGB 안의 oklch 값은 hex 로 읽고, 밖이면 읽지 않는다", () => {
    const { colors } = parseColorTokenData(
      "@theme { --color-brand: oklch(55.4% 0.046 257.417); --color-wide: oklch(84.1% 0.238 128.85); }",
    );
    expect(colors).toEqual(new Map([["#62748e", ["--color-brand"]]]));
  });
});
