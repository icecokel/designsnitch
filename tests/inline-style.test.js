import colorUnknown from "../src/rules/color-unknown.js";
import colorUseToken from "../src/rules/color-use-token.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("color-use-token (인라인 스타일)", colorUseToken, {
  valid: [
    { name: "var() 로 토큰을 쓴 인라인 스타일", code: `<div style={{ color: "var(--color-primary-500)" }} />` },
    { name: "style 이 아닌 속성의 객체", code: `<Chart options={{ color: "#3B82F6" }} />` },
    { name: "JSX 밖의 객체", code: `const theme = { color: "#3B82F6" };` },
    { name: "계산된 키", code: `<div style={{ [key]: "#3B82F6" }} />` },
    { name: "조건식 안의 값은 아직 보지 않는다", code: `<div style={{ color: on ? "#3B82F6" : "red" }} />` },
  ],
  invalid: [
    {
      name: "문자열 전체가 토큰 색",
      code: `<div style={{ color: "#3B82F6" }} />`,
      errors: [
        {
          message: "#3B82F6의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: var(--color-primary-500)",
          line: 1,
          column: 23,
          endColumn: 30,
          suggestions: [
            {
              desc: "var(--color-primary-500)(으)로 바꾸기",
              output: `<div style={{ color: "var(--color-primary-500)" }} />`,
            },
          ],
        },
      ],
    },
    {
      name: "값 가운데의 토큰 색만 바꾼다",
      code: `<div style={{ ...base, border: "1px solid #3b82f6" }} />`,
      errors: [
        {
          message: "#3b82f6의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: var(--color-primary-500)",
          suggestions: [
            {
              desc: "var(--color-primary-500)(으)로 바꾸기",
              output: `<div style={{ ...base, border: "1px solid var(--color-primary-500)" }} />`,
            },
          ],
        },
      ],
    },
    {
      name: "후보가 여럿이면 속성의 용도에 맞는 토큰을 먼저 보여 준다",
      code: `<div style={{ backgroundColor: "#fff" }} />`,
      errors: [
        {
          message:
            "#fff의 색은 토큰 --color-surface, --color-white의 값입니다. 대신 사용: var(--color-surface), var(--color-white)",
          suggestions: [
            { desc: "var(--color-surface)(으)로 바꾸기", output: `<div style={{ backgroundColor: "var(--color-surface)" }} />` },
            { desc: "var(--color-white)(으)로 바꾸기", output: `<div style={{ backgroundColor: "var(--color-white)" }} />` },
          ],
        },
      ],
    },
    {
      name: "식이 없는 템플릿 리터럴과 문자열 키",
      code: "<div style={{ \"outline-color\": `#3B82F6` }} />",
      errors: [{ message: "#3B82F6의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: var(--color-primary-500)", suggestions: [{ desc: "var(--color-primary-500)(으)로 바꾸기", output: "<div style={{ \"outline-color\": `var(--color-primary-500)` }} />" }] }],
    },
  ],
});

ruleTester.run("color-unknown (인라인 스타일)", colorUnknown, {
  valid: [{ name: "토큰이 있는 색", code: `<div style={{ color: "#3B82F6" }} />` }],
  invalid: [
    {
      name: "토큰에 없는 색",
      code: `<div style={{ color: "#3B82F5" }} />`,
      errors: [{ message: "#3B82F5의 색은 토큰에 없습니다.", line: 1, column: 23, endColumn: 30 }],
    },
  ],
});
