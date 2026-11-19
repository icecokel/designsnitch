import { describe, expect, it } from "vitest";
import { findCssColors } from "../src/core/css.js";

describe("findCssColors", () => {
  it("선언 값에 있는 hex 색을 위치, 속성과 함께 찾는다", () => {
    const css = [".card {", "  color: #3B82F6;", "  border: 1px solid #e2e1e5;", "}"].join("\n");
    expect(findCssColors(css)).toEqual([
      { line: 2, column: 10, endLine: 2, endColumn: 17, value: "#3B82F6", prop: "color", disabled: false },
      { line: 3, column: 21, endLine: 3, endColumn: 28, value: "#e2e1e5", prop: "border", disabled: false },
    ]);
  });

  it("한 선언에 색이 여러 개면 모두 찾는다", () => {
    const css = `.a { background: linear-gradient(#fff, #00000080); }`;
    expect(findCssColors(css).map((c) => c.value)).toEqual(["#fff", "#00000080"]);
  });

  it("토큰이나 변수를 정의하는 선언은 건너뛴다", () => {
    const css = `:root { --primary: #3B82F6; } @theme { --color-primary: #3B82F6; } .a { --local: #fff; }`;
    expect(findCssColors(css)).toEqual([]);
  });

  it("url(), 문자열, 주석 안의 # 은 색으로 보지 않는다", () => {
    const css = [
      `.a { clip-path: url(#abc); }`,
      `.b { background: url("sprite.svg#fff") #123456; }`,
      `.c::after { content: "#fff"; }`,
      `.d { color: /* #000 */ red; }`,
      `#abc { color: red; }`,
    ].join("\n");
    expect(findCssColors(css).map(({ line, value }) => ({ line, value }))).toEqual([
      { line: 2, value: "#123456" },
    ]);
  });

  it("앞줄에 designsnitch-disable-next-line 주석이 있는 선언은 disabled 로 표시한다", () => {
    const css = [
      ".a {",
      "  /* designsnitch-disable-next-line -- 캠페인 전용 색 */",
      "  color: #FF00AA;",
      "  background: #FF00AB;",
      "}",
    ].join("\n");
    expect(findCssColors(css).map(({ value, disabled }) => ({ value, disabled }))).toEqual([
      { value: "#FF00AA", disabled: true },
      { value: "#FF00AB", disabled: false },
    ]);
  });

  it("Tailwind v4 의 @theme, @apply, @utility 가 있어도 읽는다", () => {
    const css = `@import "tailwindcss";\n@theme { --color-a: #fff; }\n@utility card { color: #111111; }\n.b { @apply bg-[#222222]; }`;
    expect(findCssColors(css).map((c) => c.value)).toEqual(["#111111"]);
  });
});
