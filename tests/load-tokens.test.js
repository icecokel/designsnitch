import { describe, expect, it } from "vitest";
import { loadTokens } from "../src/rules/load-tokens.js";
import { tempProject } from "./temp-project.js";

describe("loadTokens", () => {
  it("설정된 경로의 CSS를 cwd 기준으로 읽는다", () => {
    const tokens = loadTokens(
      { designsnitch: { tokens: "tests/fixtures/tokens.css" } },
      process.cwd(),
    );
    expect(tokens.colors.get("#3b82f6")).toEqual(["--color-primary-500"]);
  });

  it("var 참조를 따라 최종 값이 테마마다 다른 토큰 이름을 모은다", () => {
    const cwd = tempProject({
      "tokens.css": `
        :root { --surface: #fff; --fixed: #aBc; --color-mixed: #f00; }
        .dark { --surface: #111827; --fixed: #aabbcc; --color-mixed: color-mix(in srgb, red, blue); }
        @theme {
          --alias: var(--surface);
          --color-surface: var(--alias);
          --color-fixed: var(--fixed);
        }
      `,
    });
    const tokens = loadTokens({ designsnitch: { tokens: "tokens.css" } }, cwd);
    expect(tokens.themed).toEqual(new Set(["--color-surface", "--color-mixed"]));
    expect(tokens.colors).toEqual(new Map([
      ["#ff0000", ["--color-mixed"]],
      ["#ffffff", ["--color-surface"]],
      ["#111827", ["--color-surface"]],
      ["#aabbcc", ["--color-fixed"]],
    ]));
  });

  it("경로 설정이 없으면 무엇을 설정해야 하는지 알려준다", () => {
    expect(() => loadTokens({}, process.cwd())).toThrow(
      "settings.designsnitch.tokens",
    );
  });

  it("끝의 와일드카드와 정확한 이름으로 토큰을 제외하고 남은 토큰의 var 참조는 해석한다", () => {
    const cwd = tempProject({
      "tokens.css": `
        :root { --color-chart-a: #fff; --color-exact: #abc; }
        .dark { --color-chart-a: #111; }
        @theme { --color-chartreuse: #def; --color-exact-extra: var(--color-exact); }
      `,
    });
    const load = (tokens) => loadTokens({ designsnitch: { tokens } }, cwd);
    const scoped = load({ file: "tokens.css", exclude: ["--color-chart-*", "--color-exact"] });
    expect(scoped.colors).toEqual(new Map([
      ["#ddeeff", ["--color-chartreuse"]],
      ["#aabbcc", ["--color-exact-extra"]],
    ]));
    expect(scoped.themed.size).toBe(0);
    expect(load("tokens.css").colors.get("#ffffff")).toEqual(["--color-chart-a"]);
    expect(load({ file: "tokens.css", exclude: ["*"] }).colors.size).toBe(0);
  });

  it("파일이 없으면 찾은 경로를 알려준다", () => {
    expect(() =>
      loadTokens({ designsnitch: { tokens: "nope.css" } }, "/tmp/x"),
    ).toThrow("/tmp/x/nope.css");
  });

  it("토큰 CSS 의 문법이 깨져 있으면 어느 파일의 어디인지 알려준다", () => {
    const cwd = tempProject({ "app/globals.css": `:root { --a: #fff; }\n.x\\[#fff\\] { color: red; }\n.y { color: red` });
    expect(() => loadTokens({ designsnitch: { tokens: "app/globals.css" } }, cwd)).toThrow(
      /토큰 CSS를 읽을 수 없습니다: .*app\/globals\.css:\d+:\d+/,
    );
  });
});

