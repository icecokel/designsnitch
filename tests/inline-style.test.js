import colorUnknown from "../src/rules/color-unknown.js";
import colorUseToken from "../src/rules/color-use-token.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("color-use-token (인라인 스타일)", colorUseToken, {
  valid: [
    { name: "var() 로 토큰을 쓴 인라인 스타일", code: `<div style={{ color: "var(--color-primary-500)" }} />` },
    { name: "색을 받는 이름이 아닌 키", code: `const theme = { primary: "#3B82F6" };` },
    { name: "색을 받는 이름이 아닌 JSX 속성", code: `<Chart title="#3B82F6" />` },
    { name: "계산된 키", code: `<div style={{ [key]: "#3B82F6" }} />` },
  ],
  invalid: [
    {
      name: "스타일이 아닌 객체의 색 속성은 후보를 주되 확인하라고 알린다",
      code: `<Chart options={{ color: "#3B82F6" }} />`,
      errors: [
        {
          messageId: "useTokenData",
          suggestions: [{ desc: "var(--color-primary-500)(으)로 바꾸기", output: `<Chart options={{ color: "var(--color-primary-500)" }} />` }],
        },
      ],
    },
    {
      name: "문자열 전체가 토큰 색",
      code: `<div style={{ color: "#3B82F6" }} />`,
      output: `<div style={{ color: "var(--color-primary-500)" }} />`,
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
      output: `<div style={{ ...base, border: "1px solid var(--color-primary-500)" }} />`,
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
      output: "<div style={{ \"outline-color\": `var(--color-primary-500)` }} />",
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

ruleTester.run("color-use-token (계산되는 인라인 스타일)", colorUseToken, {
  valid: [{ name: "조건식의 조건 쪽은 값이 아니다", code: `<div style={{ color: mode === "#3B82F6" ? a : b }} />` }],
  invalid: [
    {
      name: "삼항 연산의 두 값",
      code: `<div style={{ color: on ? "#3B82F6" : "#123456" }} />`,
      output: `<div style={{ color: on ? "var(--color-primary-500)" : "#123456" }} />`,
      errors: [
        {
          message: "#3B82F6의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: var(--color-primary-500)",
          suggestions: [
            { desc: "var(--color-primary-500)(으)로 바꾸기", output: `<div style={{ color: on ? "var(--color-primary-500)" : "#123456" }} />` },
          ],
        },
      ],
    },
    {
      name: "&&, ||, ?? 와 겹친 조건식",
      code: `<div style={{ color: a ? (b && "#3B82F6") : c ?? "#3b82f6", background: x || "#3B82F6" }} />`,
      output: `<div style={{ color: a ? (b && "var(--color-primary-500)") : c ?? "var(--color-primary-500)", background: x || "var(--color-primary-500)" }} />`,
      errors: [{ messageId: "useToken", suggestions: 1 }, { messageId: "useToken", suggestions: 1 }, { messageId: "useToken", suggestions: 1 }],
    },
  ],
});
