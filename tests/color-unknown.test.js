import rule from "../src/rules/color-unknown.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("color-unknown", rule, {
  valid: [
    { name: "토큰 클래스", code: `<div className="bg-primary-500" />` },
    { name: "토큰이 있는 hex는 이 규칙의 대상이 아니다", code: `<div className="bg-[#3B82F6]" />` },
  ],
  invalid: [
    {
      name: "토큰에 없는 색",
      code: `<div className="bg-[#3B82F5]" />`,
      errors: [
        { message: "bg-[#3B82F5]의 색은 토큰에 없습니다.", line: 1, column: 17, endColumn: 29 },
      ],
    },
    {
      name: "알파가 붙은 hex",
      code: `<div className="bg-[#3B82F680]" />`,
      errors: [{ message: "bg-[#3B82F680]의 색은 토큰에 없습니다." }],
    },
  ],
});
