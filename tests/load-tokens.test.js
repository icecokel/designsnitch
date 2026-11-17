import { describe, expect, it } from "vitest";
import { loadTokens } from "../src/rules/load-tokens.js";

describe("loadTokens", () => {
  it("설정된 경로의 CSS를 cwd 기준으로 읽는다", () => {
    const tokens = loadTokens(
      { designsnitch: { tokens: "tests/fixtures/tokens.css" } },
      process.cwd(),
    );
    expect(tokens.colors.get("#3b82f6")).toEqual(["--color-primary-500"]);
  });

  it("경로 설정이 없으면 무엇을 설정해야 하는지 알려준다", () => {
    expect(() => loadTokens({}, process.cwd())).toThrow(
      "settings.designsnitch.tokens",
    );
  });

  it("파일이 없으면 찾은 경로를 알려준다", () => {
    expect(() =>
      loadTokens({ designsnitch: { tokens: "nope.css" } }, "/tmp/x"),
    ).toThrow("/tmp/x/nope.css");
  });
});
