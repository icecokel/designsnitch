import rule from "../src/rules/scale-use-token.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("scale-use-token", rule, {
  valid: [
    { name: "스케일 클래스", code: `<div className="p-4 rounded-md text-sm" />` },
    { name: "스케일에 없는 값은 이 규칙의 대상이 아니다", code: `<div className="p-[15px]" />` },
    { name: "크기 유틸리티는 보지 않는다", code: `<div className="w-[320px] h-[16px]" />` },
    { name: "text의 색은 보지 않는다", code: `<div className="text-[#fff]" />` },
  ],
  invalid: [
    {
      name: "간격",
      code: `<div className="p-[16px]" />`,
      errors: [
        {
          message: "p-[16px]의 값은 간격 스케일에 있습니다. 대신 사용: p-4",
          line: 1,
          column: 17,
          endColumn: 25,
          suggestions: [{ desc: "p-4(으)로 바꾸기", output: `<div className="p-4" />` }],
        },
      ],
    },
    {
      name: "variant가 붙은 반 단계 간격",
      code: `cn("hover:px-[2px]")`,
      errors: [
        {
          message: "px-[2px]의 값은 간격 스케일에 있습니다. 대신 사용: px-0.5",
          suggestions: [{ desc: "px-0.5(으)로 바꾸기", output: `cn("hover:px-0.5")` }],
        },
      ],
    },
    {
      name: "radius",
      code: `<div className="rounded-[6px]" />`,
      errors: [
        {
          message: "rounded-[6px]의 값은 radius 토큰에 있습니다. 대신 사용: rounded-md",
          suggestions: [
            { desc: "rounded-md(으)로 바꾸기", output: `<div className="rounded-md" />` },
          ],
        },
      ],
    },
    {
      name: "폰트 크기",
      code: `<p className="text-[0.875rem]" />`,
      errors: [
        {
          message: "text-[0.875rem]의 값은 폰트 크기 토큰에 있습니다. 대신 사용: text-sm",
          suggestions: [{ desc: "text-sm(으)로 바꾸기", output: `<p className="text-sm" />` }],
        },
      ],
    },
  ],
});
