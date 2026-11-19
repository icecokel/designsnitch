# designsnitch

[English](./README.md) | 한국어

designsnitch는 디자인 시스템이 없거나 이름뿐인 프로젝트에서, UI 코드를 관리할 수 있고 일관되게 유지하도록 돕습니다. AI 에이전트가 쓴 코드를 염두에 두고 만들었습니다. AI는 그럴듯한 UI를 빠르게 만들어 내지만, 그 과정에서 색과 간격과 컴포넌트가 화면마다 흩어집니다.

디자이너나 Figma 파일 없이, 코드 안에서 일합니다.

1. **기준을 세웁니다.** 코드가 이미 쓰고 있는 값을 모아서 토큰으로 정리할 수 있게 합니다.
2. **기준을 지킵니다.** 새 코드가 그 기준을 따르는지 확인하고, 무엇으로 바꾸면 되는지 알려줍니다.
3. **정리합니다.** 이미 흩어진 코드를 기준에 맞게 되돌리는 일을 돕습니다.

무엇을 기준으로 삼을지는 개발자가 정합니다. 도구는 그 판단에 필요한 것을 가져다주는 역할을 합니다.

네 부분으로 되어 있습니다.

| 부분 | 목적 |
| --- | --- |
| CLI | AI 에이전트가 쓰는 도구입니다. 쓰이는 색을 모으고, 코드를 검사하고, 위반마다 무엇을 하면 되는지 알려줍니다. |
| 에이전트 스킬 | AI 에이전트에게 프로젝트를 어떻게 설정하고, 언제 CLI를 실행하고, 무엇을 고치고, 무엇을 사람에게 물을지 알려줍니다. |
| ESLint 플러그인 | 막고 경고합니다. 같은 규칙이 에디터와 lint 단계에서 오류와 경고로 나옵니다. |
| 에이전트 훅 | 코드를 쓰는 동안 막습니다. 에이전트는 파일을 고칠 때마다 오류를 전달받고, 스스로 고칠 수 있는 오류가 남아 있으면 작업을 끝내지 못합니다. |

**Tailwind CSS v4를 쓰는 React/Next.js 프로젝트**를 지원합니다.

> **상태:** MVP(0.1.x). CLI 메시지는 아직 한국어로만 나옵니다. JSON 출력에는 같은 정보가 언어와 무관한 필드로 들어 있습니다.

## 왜 필요한가

AI 에이전트가 만든 UI는 얼핏 보면 그럴듯하지만, 자세히 보면 조금씩 틀려 있는 경우가 많습니다.

- primary 색을 토큰 대신 `bg-[#3B82F6]`으로 박아 둬서, 테마를 바꾸면 그 부분만 색이 그대로 남습니다.
- 버튼 색이 primary와 거의 같지만 미묘하게 다릅니다.
- 디자인 시스템에 `Button`이 있는데 `<button>`으로 새로 만들어서, 높이가 조금 낮고 focus 스타일이 없습니다.

이런 차이는 리뷰에서 눈으로 잡기 어렵습니다. designsnitch는 코드를 분석해서 이런 곳을 찾아냅니다.

## 무엇을 잡는가

등급은 한 가지 기준을 따릅니다.

| 등급 | 의미 |
| --- | --- |
| **오류** | 디자인 시스템에 쓸 토큰이나 컴포넌트가 있는데 쓰지 않았습니다. 지금 화면이 같아 보여도, 디자인 시스템이 바뀌면 이 코드만 따라가지 않습니다. |
| **경고** | 디자인 시스템에 맞는 토큰이 없습니다. 새 값이 정말 필요한 건지 실수인지 사람이 판단해야 합니다. |

| 규칙 | 등급 | 잡는 것 |
| --- | --- | --- |
| `color-use-token` | 오류 | 토큰이 있는 hex 색을 임의 값(`bg-[#3B82F6]`)이나 CSS 선언(`color: #3B82F6`)에 직접 씀 |
| `color-unknown` | 경고 | 맞는 토큰이 없는 hex 색 |
| `use-ds-component` | 오류 | 공용 컴포넌트가 대체하는 `<button>` 같은 raw 태그를 디자인 시스템 경로 밖에서 씀 |

오류에는 대신 쓸 것이 함께 나옵니다. JS와 TS 파일에서는 클래스나 컴포넌트이고, CSS 파일에서는 `var(--토큰)`입니다.

## 빠른 시작

```sh
npm install --save-dev designsnitch
```

Node.js 22 이상이 필요합니다.

프로젝트 루트에 `designsnitch.config.json`을 만듭니다. [에이전트 스킬](#에이전트-스킬)을 쓰면 에이전트가 저장소를 읽어서 이 파일을 만들어 줍니다.

```json
{
  "tokens": "./app/globals.css",
  "components": {
    "path": "./components/ui",
    "replaces": {
      "button": ["SolidButton", "IconButton"],
      "input": "Input",
      "dialog": "Dialog"
    }
  }
}
```

그다음 검사를 실행합니다.

```sh
npx designsnitch check                      # 프로젝트 전체
npx designsnitch check src/PayButton.tsx    # 일부 파일만
npx designsnitch check --format json        # CI나 AI 에이전트용
```

## 토큰 없이 시작하기

색 토큰이 아직 없는 프로젝트도 있습니다. 색을 코드에 바로 적어 쓰는 경우입니다. `designsnitch colors`는 코드에서 쓰는 색을 모아 보여주므로, 이것을 토큰으로 만들 수 있습니다. 설정 파일이 없어도 동작합니다.

```sh
npx designsnitch colors
npx designsnitch colors --format json
```

```
코드에서 쓰는 색: hex 5개, 기본 팔레트 1개 (사용 10곳, 파일 1개 검사)

hex 색
  #3a11d8  3곳  파일 1개  bg 2, 문자열 1
  #484646  2곳  파일 1개  text 2
  #ffffff  2곳  파일 1개  bg 1, text 1
  #484645  1곳  파일 1개  text 1
  #e2e1e5  1곳  파일 1개  border 1

Tailwind 기본 팔레트
  gray-700  1곳  파일 1개  text 1
```

| 출력 | 의미 |
| --- | --- |
| `hex 색` | hex 색을 많이 쓰인 순서로 보여줍니다. 쓰인 횟수와 파일 수가 함께 나옵니다. |
| `bg 2`, `text 1` | Tailwind 유틸리티별 사용 횟수입니다. `bg-[#3a11d8]`은 `bg`로 셉니다. |
| `문자열 1` | 문자열 전체가 hex 색인 경우입니다. 인라인 스타일이나 차트 옵션이 여기에 들어갑니다. |
| `CSS 2` | CSS 선언에서 쓴 횟수입니다. JSON 출력에는 속성별로 나뉘어 들어갑니다. |
| `Tailwind 기본 팔레트` | `text-gray-700`처럼 Tailwind 기본 팔레트의 색을 이름으로 쓴 경우입니다. |

설정 파일이 있으면 색마다 그 값을 이미 가진 토큰이 함께 나옵니다(`토큰: --color-brand`). 없으면 `토큰 없음`으로 나옵니다. JSON 출력에는 같은 내용에 더해 색마다 예시 위치 몇 개가 들어 있습니다.

[`designsnitch-palette` 스킬](#에이전트-스킬)은 이 출력을 바탕으로 토큰을 제안하고, 사람이 승인하면 토큰을 작성합니다.

## 설정

| 항목 | 설명 |
| --- | --- |
| `tokens` | 토큰이 정의된 CSS 파일입니다. 필수입니다. |
| `components.path` | 디자인 시스템 컴포넌트가 있는 경로입니다. 이 안에서는 raw 태그를 써도 됩니다. |
| `components.replaces` | raw 태그와 그것을 대체하는 컴포넌트입니다. 한 태그를 대체하는 컴포넌트가 여러 개면 배열로 적습니다. |

`components`를 생략하면 컴포넌트 검사를 하지 않습니다. 다른 경로의 설정 파일을 쓰려면 `--config <파일>`을 붙입니다.

토큰 CSS에서 읽는 것은 다음과 같습니다.

| 변수 | 쓰임 | 없을 때 |
| --- | --- | --- |
| `--color-*` | 색. 값이 hex이거나, `var()`를 따라가면 hex가 나와야 합니다. | 모든 hex 색이 경고가 됩니다 |

아래 두 형태를 모두 읽습니다.

```css
/* @theme 안에 값을 직접 적은 형태 */
@theme {
  --color-primary-500: #3B82F6;
  --color-surface: #ffffff;
}

/* :root에 값을 두고 @theme에서 가리키는 형태 */
:root {
  --primary-500: #3B82F6;
}
@theme {
  --color-primary-500: var(--primary-500);
}
```

## 출력

```
디자인 시스템: 색 토큰 2개, 컴포넌트 2개

src/PayButton.tsx
  5:6  오류  <button> 대신 디자인 시스템 컴포넌트를 사용하세요: Button (./components/ui)  (use-ds-component)
  7:55  오류  bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500  (color-use-token)
  8:26  경고  bg-[#3B82F5]의 색은 토큰에 없습니다.  (color-unknown)

오류 2개, 경고 1개 (파일 3개 검사)
바로 바꿀 수 있는 것 2건, 사람이 정해야 하는 것 1건
```

첫 줄은 설정에서 읽어 낸 토큰과 컴포넌트의 개수입니다. 경로를 잘못 적으면 여기서 0개로 드러납니다. 색 토큰을 하나도 읽지 못하면 `주의:`로 시작하는 줄이 이유를 알려줍니다. 마지막 줄은 바로 바꿀 수 있는 위반과 사람이 정해야 하는 위반이 각각 몇 건인지 알려줍니다.

`--format json`은 같은 결과를 구조화해서 출력합니다.

```json
{
  "designSystem": { "colorTokens": 2, "components": 2, "replacedTags": 2 },
  "problems": [],
  "next": [
    "action이 replace인 2건은 found를 candidates의 값으로 바꾸세요.",
    "action이 ask인 1건은 바꾸지 말고 사용자에게 물으세요. ...",
    "고친 뒤 같은 명령을 다시 실행하세요."
  ],
  "summary": { "files": 3, "errors": 2, "warnings": 1 },
  "violations": [
    {
      "file": "src/PayButton.tsx",
      "line": 7,
      "column": 55,
      "endLine": 7,
      "endColumn": 67,
      "rule": "color-use-token",
      "severity": "error",
      "message": "bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500",
      "found": "bg-[#3B82F6]",
      "candidates": ["bg-primary-500"],
      "action": "replace"
    }
  ]
}
```

| 필드 | 내용 |
| --- | --- |
| `designSystem` | 설정에서 읽어 낸 토큰과 컴포넌트의 개수 |
| `problems` | 결과를 믿기 어렵게 만드는 설정 문제. 정상이면 빈 배열입니다. |
| `violations[].found` | 위반한 코드 조각 |
| `violations[].candidates` | 대신 쓸 클래스나 컴포넌트. 없으면 빈 배열입니다. |
| `violations[].action` | 이 위반을 어떻게 다룰지입니다. `replace`: 후보가 하나뿐인 오류라서 `found`를 그 후보로 바꾸면 됩니다. `ask`: 사람이 정해야 합니다(후보가 여러 개이거나 토큰이 없는 색). `repair`: 파일을 읽지 못했습니다. |
| `next` | 이 결과를 받은 에이전트가 할 일을 순서대로 적은 것 |

| 종료 코드 | 의미 |
| --- | --- |
| 0 | 오류 없음 (경고만 있어도 0) |
| 1 | 오류 있음 |
| 2 | 실행하지 못함 (설정 파일, 토큰 CSS, 컴포넌트 경로가 없거나 인자가 잘못됨) |

검사는 프로젝트의 ESLint 설정과 무관하게 돌아갑니다. `.js`, `.jsx`, `.ts`, `.tsx`, `.css` 파일을 읽고, `node_modules`, `.next`, `dist`, `build`, `out`, `coverage`는 건너뜁니다.

## 예외

의도적으로 허용하는 곳에는 주석을 답니다.

```tsx
{/* eslint-disable-next-line designsnitch/color-unknown -- 캠페인 전용 색 */}
<p className="text-[#FF00AA]">캠페인</p>
```

CSS 파일에서는 선언 바로 앞줄에 이 주석을 답니다.

```css
.campaign {
  /* designsnitch-disable-next-line -- 캠페인 전용 색 */
  color: #FF00AA;
}
```

## 에이전트 스킬

스킬은 패키지의 `skills/` 디렉터리에 있습니다. 에이전트의 스킬 디렉터리에 복사해서 씁니다. Claude Code라면 다음과 같습니다.

```sh
mkdir -p .claude/skills
cp -r node_modules/designsnitch/skills/* .claude/skills/
```

스킬 하나가 일 하나를 맡습니다.

| 스킬 | 에이전트가 쓰는 때 | 하는 일 |
| --- | --- | --- |
| `designsnitch-check` | UI 코드를 수정한 뒤 | 검사를 실행하고, 바꿀 수 있는 것을 바꾸고, 나머지는 판단에 필요한 사실과 함께 사람에게 묻습니다. |
| `designsnitch-setup` | 설정 파일이 없을 때 | 코드베이스에서 토큰 CSS와 공용 컴포넌트 경로를 찾아 `designsnitch.config.json`을 쓰고, 읽어 낸 내용을 확인한 뒤 ESLint 플러그인과 에이전트 훅까지 연결합니다. |
| `designsnitch-palette` | 프로젝트에 색 토큰이 없을 때 | `designsnitch colors`로 쓰이는 색을 모으고, 토큰을 제안하고, 사람이 승인하면 작성합니다. |
| `designsnitch-hooks` | 설정의 한 단계 | `designsnitch hook`을 코딩 에이전트에 등록합니다. 에이전트는 파일을 고칠 때마다 오류를 전달받고, 고칠 수 있는 오류가 남아 있으면 끝내지 못합니다. |
| `designsnitch-eslint` | 설정의 한 단계 | 규칙을 프로젝트의 ESLint에 넣고, ESLint가 없으면 설치합니다. 프로젝트에 이미 오류가 있으면 먼저 묻습니다. |

스킬들은 몇 가지 원칙을 공유합니다. 에이전트는 여러 후보 중 하나를 임의로 고르지 않고, 검사를 통과시키려고 규칙을 끄지 않으며, 이미 있는 설정 파일이나 토큰을 묻지 않고 바꾸지 않습니다. 설정 파일과 토큰은 코드를 판정하는 기준입니다.

## ESLint

같은 규칙을 프로젝트의 ESLint 안에서 돌릴 수 있습니다. 그러면 에디터와 기존 lint 단계에서 위반이 바로 보입니다. ESLint 설정이 `designsnitch.config.json`을 읽어 쓰므로 기준은 한 곳에만 적습니다.

```js
// eslint.config.js
import designsnitch from "designsnitch";
import designSystem from "./designsnitch.config.json" with { type: "json" };

export default [
  // ...기존 설정
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { designsnitch },
    settings: { designsnitch: designSystem },
    rules: {
      // 오류: 디자인 시스템에 쓸 토큰이나 컴포넌트가 있는데 쓰지 않음
      "designsnitch/color-use-token": "error",
      "designsnitch/use-ds-component": "error",
      // 경고: 디자인 시스템에 없는 값이라 사람이 판단해야 함
      "designsnitch/color-unknown": "warn",
    },
  },
];
```

같은 규칙 묶음을 `designsnitch.configs.recommended`로도 쓸 수 있습니다. 이미 위반이 많은 프로젝트에 넣으면 오류 등급 규칙 때문에 기존 lint 단계가 실패하므로, 먼저 `designsnitch check`로 개수를 확인하세요. 대체 후보는 ESLint의 제안으로 보고되어 에디터에서 빠른 수정으로 나타납니다. CSS 파일은 ESLint가 아니라 CLI에서만 검사합니다.

## 위반을 막는 방법

CLI와 스킬은 AI 에이전트가 제대로 할 수 있는 상태를 만들어 줍니다. 막는 일은 다른 두 곳에서 합니다.

| 어디서 | 언제 잡는가 | 방법 |
| --- | --- | --- |
| ESLint 플러그인 | 에디터와 lint 단계 | 오류가 있으면 lint 단계가 실패합니다. CI에서 lint를 돌리고 통과를 필수로 걸면, 오류가 있는 코드는 병합되지 않습니다. |
| 에이전트 훅 | 에이전트가 코드를 쓰는 동안 | `designsnitch hook`이 파일을 고칠 때마다, 그리고 에이전트가 작업을 끝내기 전에 실행됩니다. |

### 에이전트 훅

스킬은 에이전트가 따르지 않을 수도 있는 안내입니다. 훅은 에이전트의 실행 환경이 매번 실행합니다. Claude Code라면 `.claude/settings.json`에 다음을 넣습니다.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "npx designsnitch hook" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "npx designsnitch hook" }]
      }
    ]
  }
}
```

`designsnitch hook`은 에이전트가 방금 바꾼 파일만 검사합니다.

- 파일을 고친 뒤 그 파일에 오류가 있으면, 에이전트는 오류와 다음에 할 일을 전달받습니다.
- 에이전트가 작업을 끝내려 할 때 스스로 고칠 수 있는 오류가 남아 있으면 끝내지 못합니다. 사람이 정해야 하는 오류는 막지 않습니다. 물어보려면 멈춰야 하기 때문입니다.
- 경고는 막지 않고, 에이전트가 건드리지 않은 파일의 위반은 그대로 둡니다.

이 명령은 표준 입력으로 JSON을 받을 수 있습니다(`tool_input.file_path`, `hook_event_name`, `stop_hook_active`). 막을 때는 종료 코드 2로 끝나며 stderr에 내용을 쓰고, 파일이 주어지지 않으면 git에서 바뀐 파일을 검사합니다. 같은 방식의 명령 훅을 지원하는 다른 에이전트에서도 쓸 수 있습니다. `designsnitch-hooks` 스킬이 이 설정을 해 줍니다.

### Tailwind 기본 팔레트

designsnitch는 `bg-blue-500` 같은 기본 팔레트 클래스를 위반으로 잡지 않습니다. 프로젝트가 자기 토큰만 써야 한다면, Tailwind v4에서 기본 팔레트를 없앨 수 있습니다. 그러면 그런 클래스가 아예 동작하지 않습니다.

```css
@theme {
  --color-*: initial;
  --color-primary-500: #3B82F6;
}
```

## 검사 범위

- **JS와 TS에서 보는 곳:** 문자열과 템플릿 리터럴입니다. `className`과 `cn()`, `clsx()`, `cva()`의 인자가 여기에 들어갑니다. 주석은 보지 않습니다.
- **CSS에서 보는 곳:** `.css` 파일(CSS Modules 포함)의 선언 값에 있는 hex 색입니다. 변수를 정의하는 선언(`--이름: ...`)은 토큰을 정의하는 곳이므로 건너뜁니다. CSS에서는 아직 색만 검사합니다.
- **테마:** 토큰이 테마마다 다른 값을 가지면 그 값들을 모두 그 토큰의 값으로 봅니다.
- **수정:** designsnitch는 후보를 알려줄 뿐, 후보가 하나여도 코드를 직접 고치지 않습니다.

### 아직 안 되는 것

- hex가 아닌 색(`rgb()`, `hsl()`, `oklch()`)
- Tailwind 기본 테마의 값. 프로젝트의 토큰 CSS에 적힌 값만 읽습니다.
- Tailwind v3(`tailwind.config.js`)
- 토큰이 없는 색에 가장 가까운 토큰 제시
- 인라인 스타일
- SCSS 같은 전처리기
- 간격, 폰트 크기, radius. 이번 버전에서는 일부러 뺐습니다.
- `@apply` 안의 클래스
- 직접 만든 컴포넌트와 디자인 시스템 컴포넌트의 스타일 비교
- 스킬과 훅을 설치해 주는 명령

Figma 같은 시안 파일과 화면을 비교하는 일은 범위 밖입니다. 기준은 디자인 시스템 하나입니다.

## 동작 구조

스킬과 실제 일을 하는 도구를 나누는 방식은 Chrome 팀의 Modern Web Guidance를 따랐습니다. 판정은 CLI가 하고, 스킬은 에이전트가 언제 CLI를 부르고 결과를 어떻게 다룰지만 정합니다. 사람과 AI가 같은 규칙과 같은 결과를 씁니다.

| 층 | 위치 | 하는 일 |
| --- | --- | --- |
| 코어 | `src/core` | 토큰 CSS를 읽어 "값 → 토큰" 표를 만들고, 문자열과 CSS에서 색 클래스와 색 값을 찾습니다. ESLint에 의존하지 않습니다. |
| 규칙 | `src/rules` | AST에서 문자열과 JSX 태그를 찾아 코어에 묻고, 위반과 후보를 보고합니다. ESLint 규칙 형식으로 작성했습니다. |
| 검사 엔진 | `src/check.js` | 규칙을 프로젝트에 실행하고 결과를 위반 목록으로 정리합니다. 코드를 파싱하고 순회하는 데 내부적으로 ESLint를 씁니다. |
| CLI | `src/cli.js` | 인자와 설정 파일을 읽어 엔진을 부르고 결과를 출력합니다. |
| 훅 | `src/hook.js` | 에이전트가 방금 바꾼 파일을 검사하고, 막을지 정합니다. |
| 스킬 | `skills/` | 에이전트용 지시문입니다. 일 하나에 스킬 하나입니다. |

## 개발

```sh
npm install
npm test
```

### 릴리스

`main`에 병합하는 것만으로는 배포되지 않습니다. 버전 태그를 푸시하면 GitHub Actions가 테스트를 돌린 뒤 npm에 배포합니다.

```sh
npm version patch        # package.json 버전을 올리고, 커밋하고, v0.1.1 같은 태그를 만듭니다
git push --follow-tags   # 커밋과 태그를 푸시하면 릴리스가 시작됩니다
```

태그와 `package.json`의 버전이 다르거나, 태그가 붙은 커밋이 `main`에 없으면 릴리스가 멈춥니다.

## 라이선스

[MIT](./LICENSE)
