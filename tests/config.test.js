import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const project = path.resolve("tests/fixtures/project");

describe("loadConfig", () => {
  it("프로젝트의 designsnitch.config.json 을 읽는다", () => {
    expect(loadConfig(project)).toEqual({
      tokens: "./app/globals.css",
      components: { path: "./components/ui", replaces: { button: "Button" } },
    });
  });

  it("설정 파일이 없으면 어디에 무엇을 만들어야 하는지 알려준다", () => {
    expect(() => loadConfig("/tmp/no-such-project")).toThrow(
      "/tmp/no-such-project/designsnitch.config.json",
    );
  });

  it("tokens 가 없으면 알려준다", () => {
    expect(() => loadConfig(project, "../no-tokens.config.json")).toThrow('"tokens"');
  });

  it("JSON 이 깨져 있으면 파일 경로와 함께 알려준다", () => {
    expect(() => loadConfig(project, "../broken.config.json")).toThrow(
      "broken.config.json",
    );
  });
});
