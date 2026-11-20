import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { tempProject } from "./temp-project.js";

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
    expect(() => loadConfig("/tmp/no-such-project")).toThrow("designsnitch-setup");
  });

  it("tokens 가 없으면 알려준다", () => {
    expect(() => loadConfig(project, "../no-tokens.config.json")).toThrow('"tokens"');
  });

  it("tokens 객체에서 경로, 제외 패턴, 선호 접두어를 읽는다", () => {
    const tokens = { file: "tokens.css", exclude: ["--color-chart-*", "--color-white"], prefer: ["--color-text-"] };
    const cwd = tempProject({ "designsnitch.config.json": JSON.stringify({ tokens }) });
    expect(loadConfig(cwd).tokens).toEqual(tokens);
  });

  it.each([
    [{ exclude: [] }, "tokens.file"],
    [{ file: "tokens.css", exclude: "--color-chart-*" }, "tokens.exclude"],
    [{ file: "tokens.css", exclude: ["--color-*-chart"] }, "tokens.exclude"],
    [{ file: "tokens.css", prefer: [1] }, "tokens.prefer"],
    [{ file: "tokens.css", prefer: ["--color-text-*"] }, "tokens.prefer"],
  ])("tokens 객체의 %j 설정에서 잘못된 항목을 알려준다", (tokens, field) => {
    const cwd = tempProject({ "designsnitch.config.json": JSON.stringify({ tokens }) });
    expect(() => loadConfig(cwd)).toThrow(`"${field}"`);
  });

  it("JSON 이 깨져 있으면 파일 경로와 함께 알려준다", () => {
    expect(() => loadConfig(project, "../broken.config.json")).toThrow(
      "broken.config.json",
    );
  });

  it("replaces 는 컴포넌트 하나 또는 여러 개를 받는다", () => {
    const cwd = tempProject({
      "designsnitch.config.json": JSON.stringify({
        tokens: "tokens.css",
        components: {
          path: "ui",
          replaces: { button: ["SolidButton", "GlassButton"], input: "Input" },
        },
      }),
    });
    expect(loadConfig(cwd).components.replaces).toEqual({
      button: ["SolidButton", "GlassButton"],
      input: "Input",
    });
  });

  it.each([
    ["components 에 path 가 없음", { replaces: { button: "Button" } }, '"components.path"'],
    ["components 에 replaces 가 없음", { path: "ui" }, '"components.replaces"'],
    ["replaces 의 값이 문자열이나 문자열 배열이 아님", { path: "ui", replaces: { button: 1 } }, '"components.replaces.button"'],
    ["replaces 의 값이 빈 배열", { path: "ui", replaces: { button: [] } }, '"components.replaces.button"'],
  ])("%s 이면 어느 항목이 잘못됐는지 알려준다", (_name, components, expected) => {
    const cwd = tempProject({
      "designsnitch.config.json": JSON.stringify({ tokens: "tokens.css", components }),
    });
    expect(() => loadConfig(cwd)).toThrow(expected);
  });

  it.each([
    ["when 이 null", null, "when"],
    ["when 이 배열", ["text"], "when"],
    ["when 의 속성 조건이 배열이 아님", { type: "text" }, "when.type"],
    ["when 의 속성 조건에 수가 들어 있음", { type: ["text", 1] }, "when.type"],
  ])("%s 이면 잘못된 조건의 경로를 알려준다", (_name, when, field) => {
    const cwd = tempProject({
      "designsnitch.config.json": JSON.stringify({
        tokens: "tokens.css",
        components: { path: "ui", replaces: { input: { component: "InputCell", when } } },
      }),
    });
    expect(() => loadConfig(cwd)).toThrow(`"components.replaces.input.${field}"`);
  });

  it("객체 설정의 component 가 유효하지 않으면 해당 경로를 알려준다", () => {
    const cwd = tempProject({
      "designsnitch.config.json": JSON.stringify({
        tokens: "tokens.css",
        components: { path: "ui", replaces: { input: { component: [] } } },
      }),
    });
    expect(() => loadConfig(cwd)).toThrow('"components.replaces.input.component"');
  });
});
