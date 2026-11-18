import rule from "../src/rules/use-ds-component.js";
import { ruleTester } from "./rule-tester.js";

const settings = {
  designsnitch: {
    tokens: "tests/fixtures/tokens.css",
    components: {
      path: "components/ui",
      replaces: { button: "Button", input: "Input", select: "Select", dialog: "Dialog" },
    },
  },
};

ruleTester.run("use-ds-component", rule, {
  valid: [
    { name: "디자인 시스템 컴포넌트", code: `<Button>확인</Button>`, settings },
    { name: "대체 대상이 아닌 태그", code: `<div><span>확인</span></div>`, settings },
    {
      name: "디자인 시스템 경로 안에서는 raw 태그를 써도 된다",
      code: `<button className="h-10" />`,
      filename: "components/ui/Button.jsx",
      settings,
    },
    {
      name: "점 표기 컴포넌트는 보지 않는다",
      code: `<motion.button />`,
      settings,
    },
    {
      name: "components 설정이 없으면 아무것도 하지 않는다",
      code: `<button />`,
      settings: { designsnitch: { tokens: "tests/fixtures/tokens.css" } },
    },
  ],
  invalid: [
    {
      name: "디자인 시스템 밖의 raw 태그",
      code: `<button onClick={pay}>결제</button>`,
      filename: "features/checkout/PayButton.jsx",
      settings,
      errors: [
        {
          message: "<button> 대신 디자인 시스템 컴포넌트를 사용하세요: Button (components/ui)",
          line: 1,
          column: 2,
          endColumn: 8,
        },
      ],
    },
    {
      name: "한 파일에 여러 개",
      code: `<form><input /><select></select></form>`,
      settings,
      errors: [
        { message: "<input> 대신 디자인 시스템 컴포넌트를 사용하세요: Input (components/ui)" },
        { message: "<select> 대신 디자인 시스템 컴포넌트를 사용하세요: Select (components/ui)" },
      ],
    },
    {
      name: "대체 컴포넌트가 여러 개면 모두 알려준다",
      code: `<button />`,
      settings: {
        designsnitch: {
          tokens: "tests/fixtures/tokens.css",
          components: {
            path: "components/ui",
            replaces: { button: ["SolidButton", "GlassButton", "IconButton"] },
          },
        },
      },
      errors: [
        {
          message:
            "<button> 대신 디자인 시스템 컴포넌트를 사용하세요: SolidButton, GlassButton, IconButton (components/ui)",
        },
      ],
    },
    {
      name: "경로 이름이 앞부분만 같은 디렉터리는 디자인 시스템이 아니다",
      code: `<dialog />`,
      filename: "components/ui-legacy/Modal.jsx",
      settings,
      errors: [{ messageId: "useComponent" }],
    },
  ],
});
