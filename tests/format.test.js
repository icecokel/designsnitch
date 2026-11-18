import { describe, expect, it } from "vitest";
import { formatText } from "../src/format.js";

const violation = (overrides) => ({
  file: "src/PayButton.tsx",
  line: 5,
  column: 24,
  endLine: 5,
  endColumn: 36,
  rule: "color-use-token",
  severity: "error",
  message: "bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500",
  found: "bg-[#3B82F6]",
  candidates: ["bg-primary-500"],
  ...overrides,
});

const designSystem = {
  colorTokens: 175,
  radiusTokens: 4,
  textTokens: 0,
  components: 3,
  replacedTags: 2,
};
const HEADER = "디자인 시스템: 색 토큰 175개, radius 토큰 4개, 폰트 크기 토큰 0개, 컴포넌트 3개";

describe("formatText", () => {
  it("파일별로 묶어 위치, 등급, 메시지, 규칙을 보여주고 끝에 요약을 붙인다", () => {
    const text = formatText({
      designSystem,
      problems: [],
      summary: { files: 3, errors: 1, warnings: 2 },
      violations: [
        violation(),
        violation({
          line: 12,
          column: 3,
          rule: "scale-unknown",
          severity: "warning",
          message: "p-[15px]의 값은 간격 스케일에 없습니다. 가까운 값: p-3.5 (14px), p-4 (16px)",
        }),
        violation({
          file: "src/Card.tsx",
          line: 2,
          column: 9,
          rule: "color-unknown",
          severity: "warning",
          message: "bg-[#123456]의 색은 토큰에 없습니다.",
        }),
      ],
    });

    expect(text).toBe(
      [
        HEADER,
        "",
        "src/PayButton.tsx",
        "  5:24  오류  bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500  (color-use-token)",
        "  12:3  경고  p-[15px]의 값은 간격 스케일에 없습니다. 가까운 값: p-3.5 (14px), p-4 (16px)  (scale-unknown)",
        "",
        "src/Card.tsx",
        "  2:9  경고  bg-[#123456]의 색은 토큰에 없습니다.  (color-unknown)",
        "",
        "오류 1개, 경고 2개 (파일 3개 검사)",
        "",
      ].join("\n"),
    );
  });

  it("위반이 없으면 없다고 알린다", () => {
    expect(
      formatText({
        designSystem,
        problems: [],
        summary: { files: 3, errors: 0, warnings: 0 },
        violations: [],
      }),
    ).toBe(`${HEADER}\n\n위반이 없습니다. (파일 3개 검사)\n`);
  });

  it("컴포넌트 설정이 없으면 없다고 적는다", () => {
    const text = formatText({
      designSystem: { ...designSystem, components: 0, replacedTags: 0 },
      problems: [],
      summary: { files: 1, errors: 0, warnings: 0 },
      violations: [],
    });
    expect(text.split("\n")[0]).toBe(
      "디자인 시스템: 색 토큰 175개, radius 토큰 4개, 폰트 크기 토큰 0개, 컴포넌트 설정 없음",
    );
  });

  it("설정에 문제가 있으면 결과보다 먼저 알린다", () => {
    const text = formatText({
      designSystem: { ...designSystem, colorTokens: 0 },
      problems: ["색 토큰을 하나도 읽지 못했습니다: tokens.css"],
      summary: { files: 1, errors: 0, warnings: 0 },
      violations: [],
    });
    expect(text.split("\n").slice(0, 3)).toEqual([
      "디자인 시스템: 색 토큰 0개, radius 토큰 4개, 폰트 크기 토큰 0개, 컴포넌트 3개",
      "주의: 색 토큰을 하나도 읽지 못했습니다: tokens.css",
      "",
    ]);
  });
});
