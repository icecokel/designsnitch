import rule from "../src/rules/scale-unknown.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("scale-unknown", rule, {
  valid: [
    { name: "스케일 클래스", code: `<div className="p-4 rounded-md text-sm" />` },
    { name: "스케일에 있는 값은 이 규칙의 대상이 아니다", code: `<div className="p-[16px]" />` },
    { name: "크기 유틸리티는 보지 않는다", code: `<div className="w-[13px]" />` },
  ],
  invalid: [
    {
      name: "간격",
      code: `<div className="p-[15px]" />`,
      errors: [
        {
          message:
            "p-[15px]의 값은 간격 스케일에 없습니다. 가까운 값: p-3.5 (14px), p-4 (16px)",
          line: 1,
          column: 17,
          endColumn: 25,
          suggestions: [
            { desc: "p-3.5(으)로 바꾸기", output: `<div className="p-3.5" />` },
            { desc: "p-4(으)로 바꾸기", output: `<div className="p-4" />` },
          ],
        },
      ],
    },
    {
      name: "radius",
      code: `<div className="rounded-[5px]" />`,
      errors: [
        {
          message:
            "rounded-[5px]의 값은 radius 토큰에 없습니다. 가까운 값: rounded-sm (4px), rounded-md (6px)",
          suggestions: [
            { desc: "rounded-sm(으)로 바꾸기", output: `<div className="rounded-sm" />` },
            { desc: "rounded-md(으)로 바꾸기", output: `<div className="rounded-md" />` },
          ],
        },
      ],
    },
    {
      name: "폰트 크기",
      code: `<p className="text-[13px]" />`,
      errors: [
        {
          message: "text-[13px]의 값은 폰트 크기 토큰에 없습니다. 가까운 값: text-sm (14px)",
          suggestions: [{ desc: "text-sm(으)로 바꾸기", output: `<p className="text-sm" />` }],
        },
      ],
    },
  ],
});
