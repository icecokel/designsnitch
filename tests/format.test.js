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

describe("formatText", () => {
  it("파일별로 묶어 위치, 등급, 메시지, 규칙을 보여주고 끝에 요약을 붙인다", () => {
    const text = formatText({
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
    expect(formatText({ summary: { files: 3, errors: 0, warnings: 0 }, violations: [] })).toBe(
      "위반이 없습니다. (파일 3개 검사)\n",
    );
  });
});
