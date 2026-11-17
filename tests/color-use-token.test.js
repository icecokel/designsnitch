import rule from "../src/rules/color-use-token.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("color-use-token", rule, {
  valid: [
    { name: "토큰 클래스", code: `<div className="bg-primary-500" />` },
    { name: "토큰이 없는 hex는 이 규칙의 대상이 아니다", code: `<div className="bg-[#123456]" />` },
    { name: "주석은 보지 않는다", code: `// bg-[#3B82F6]\nconst a = 1;` },
  ],
  invalid: [
    {
      name: "className 안의 토큰 색",
      code: `<div className="px-4 bg-[#3B82F6]" />`,
      errors: [
        {
          message:
            "bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500",
          line: 1,
          column: 22,
          endColumn: 34,
          suggestions: [
            {
              desc: "bg-primary-500(으)로 바꾸기",
              output: `<div className="px-4 bg-primary-500" />`,
            },
          ],
        },
      ],
    },
    {
      name: "함수 인자 안의 문자열 (대소문자 무시)",
      code: `cn("text-[#3b82f6]", active && "hover:border-[#3B82F6]")`,
      errors: [
        {
          message:
            "text-[#3b82f6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: text-primary-500",
          suggestions: [
            {
              desc: "text-primary-500(으)로 바꾸기",
              output: `cn("text-primary-500", active && "hover:border-[#3B82F6]")`,
            },
          ],
        },
        {
          message:
            "border-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: border-primary-500",
          suggestions: [
            {
              desc: "border-primary-500(으)로 바꾸기",
              output: `cn("text-[#3b82f6]", active && "hover:border-primary-500")`,
            },
          ],
        },
      ],
    },
    {
      name: "템플릿 리터럴",
      code: "const c = `bg-[#3B82F6] ${extra}`;",
      errors: [
        {
          messageId: "useToken",
          line: 1,
          column: 12,
          endColumn: 24,
          suggestions: [
            { desc: "bg-primary-500(으)로 바꾸기", output: "const c = `bg-primary-500 ${extra}`;" },
          ],
        },
      ],
    },
    {
      name: "값이 같은 토큰이 여러 개면 모두 알려준다",
      code: `<div className="bg-[#FFF]" />`,
      errors: [
        {
          message:
            "bg-[#FFF]의 색은 토큰 --color-white, --color-surface의 값입니다. 대신 사용: bg-white, bg-surface",
          suggestions: [
            { desc: "bg-white(으)로 바꾸기", output: `<div className="bg-white" />` },
            { desc: "bg-surface(으)로 바꾸기", output: `<div className="bg-surface" />` },
          ],
        },
      ],
    },
  ],
});
