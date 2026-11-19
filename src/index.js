import { createRequire } from "node:module";
import colorUnknown from "./rules/color-unknown.js";
import colorUseToken from "./rules/color-use-token.js";
import useDsComponent from "./rules/use-ds-component.js";

const { version } = createRequire(import.meta.url)("../package.json");

const plugin = {
  meta: { name: "designsnitch", version },
  rules: {
    "color-use-token": colorUseToken,
    "color-unknown": colorUnknown,
    "use-ds-component": useDsComponent,
  },
  configs: {},
};

// 오류: 디자인 시스템에 쓸 것이 있는데 쓰지 않음. 경고: 디자인 시스템에 없는 값.
plugin.configs.recommended = {
  name: "designsnitch/recommended",
  plugins: { designsnitch: plugin },
  rules: {
    "designsnitch/color-use-token": "error",
    "designsnitch/color-unknown": "warn",
    "designsnitch/use-ds-component": "error",
  },
};

export default plugin;
