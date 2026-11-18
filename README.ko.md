# designsnitch

[English](./README.md) | 한국어

designsnitch는 UI 코드에서 프로젝트의 디자인 시스템을 벗어난 곳을 찾고, 무엇으로 바꾸면 되는지 알려줍니다. AI 에이전트가 쓴 코드를 염두에 두고 만들었습니다. 그런 코드는 겉보기에는 멀쩡하지만 토큰과 공용 컴포넌트를 조용히 건너뛰는 일이 많습니다.

세 부분으로 되어 있습니다.

| 부분 | 하는 일 |
| --- | --- |
| 검사 엔진 | 코드를 분석해 위반 위치와 대체 후보를 찾습니다. |
| CLI | `designsnitch check`로 검사를 실행하고, `designsnitch colors`로 코드에서 쓰는 색을 모읍니다. 둘 다 사람이 읽는 결과나 JSON을 출력합니다. |
| 에이전트 스킬 | AI 에이전트에게 언제 CLI를 실행하고, 무엇을 고치고, 무엇을 사람에게 물을지 알려줍니다. |

**Tailwind CSS v4를 쓰는 React/Next.js 프로젝트**를 지원합니다.

> **상태:** MVP(0.1.x). CLI 메시지는 아직 한국어로만 나옵니다. JSON 출력에는 같은 정보가 언어와 무관한 필드로 들어 있습니다.

## 왜 필요한가

AI 에이전트가 만든 UI는 얼핏 보면 그럴듯하지만, 자세히 보면 조금씩 틀려 있는 경우가 많습니다.

- primary 색을 토큰 대신 `bg-[#3B82F6]`으로 박아 둬서, 테마를 바꾸면 그 부분만 색이 그대로 남습니다.
- 버튼 색이 primary와 거의 같지만 미묘하게 다릅니다.
- 간격이 `p-4`여야 할 곳에 `p-[15px]`나 `p-[18px]`가 들어가 있습니다.
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
| `color-use-token` | 오류 | 토큰이 있는 hex 색을 임의 값으로 씀 (`bg-[#3B82F6]`) |
| `color-unknown` | 경고 | 맞는 토큰이 없는 hex 색 |
| `scale-use-token` | 오류 | 스케일에 있는 간격, 폰트 크기, radius 값을 임의 값으로 씀 (`p-[16px]`) |
| `scale-unknown` | 경고 | 스케일에 없는 간격, 폰트 크기, radius 값 |
| `use-ds-component` | 오류 | 공용 컴포넌트가 대체하는 `<button>` 같은 raw 태그를 디자인 시스템 경로 밖에서 씀 |

오류에는 대신 쓸 클래스나 컴포넌트가 함께 나옵니다. `scale-unknown`에는 스케일에서 가장 가까운 값이 함께 나옵니다.

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

토큰 CSS에서 읽는 변수는 다음과 같습니다.

| 변수 | 쓰임 | 없을 때 |
| --- | --- | --- |
| `--color-*` | 색. 값이 hex이거나, `var()`를 따라가면 hex가 나와야 합니다. | 모든 hex 색이 경고가 됩니다 |
| `--spacing` | 간격 단위 | Tailwind 기본값 `0.25rem`을 씁니다 |
| `--radius-*` | radius | radius를 검사하지 않습니다 |
| `--text-*` | 폰트 크기 | 폰트 크기를 검사하지 않습니다 |

아래 두 형태를 모두 읽습니다.

```css
/* @theme 안에 값을 직접 적은 형태 */
@theme {
  --color-primary-500: #3B82F6;
  --radius-md: 0.375rem;
  --text-sm: 0.875rem;
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
디자인 시스템: 색 토큰 2개, radius 토큰 2개, 폰트 크기 토큰 2개, 컴포넌트 2개

src/PayButton.tsx
  5:6  오류  <button> 대신 디자인 시스템 컴포넌트를 사용하세요: Button (./components/ui)  (use-ds-component)
  7:10  오류  rounded-[6px]의 값은 radius 토큰에 있습니다. 대신 사용: rounded-md  (scale-use-token)
  7:24  오류  px-[16px]의 값은 간격 스케일에 있습니다. 대신 사용: px-4  (scale-use-token)
  7:34  경고  py-[7px]의 값은 간격 스케일에 없습니다. 가까운 값: py-1.5 (6px), py-2 (8px)  (scale-unknown)
  7:55  오류  bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500  (color-use-token)
  8:26  경고  bg-[#3B82F5]의 색은 토큰에 없습니다.  (color-unknown)

오류 4개, 경고 2개 (파일 3개 검사)
```

첫 줄은 설정에서 읽어 낸 토큰과 컴포넌트의 개수입니다. 경로를 잘못 적으면 여기서 0개로 드러납니다. 색 토큰을 하나도 읽지 못하면 `주의:`로 시작하는 줄이 이유를 알려줍니다.

`--format json`은 같은 결과를 구조화해서 출력합니다.

```json
{
  "designSystem": {
    "colorTokens": 2,
    "radiusTokens": 2,
    "textTokens": 2,
    "components": 2,
    "replacedTags": 2
  },
  "problems": [],
  "summary": { "files": 3, "errors": 4, "warnings": 2 },
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
      "candidates": ["bg-primary-500"]
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

| 종료 코드 | 의미 |
| --- | --- |
| 0 | 오류 없음 (경고만 있어도 0) |
| 1 | 오류 있음 |
| 2 | 실행하지 못함 (설정 파일, 토큰 CSS, 컴포넌트 경로가 없거나 인자가 잘못됨) |

검사는 프로젝트의 ESLint 설정과 무관하게 돌아갑니다. `.js`, `.jsx`, `.ts`, `.tsx` 파일을 읽고, `node_modules`, `.next`, `dist`, `build`, `out`, `coverage`는 건너뜁니다.

## 예외

의도적으로 허용하는 곳에는 주석을 답니다.

```tsx
{/* eslint-disable-next-line designsnitch/color-unknown -- 캠페인 전용 색 */}
<p className="text-[#FF00AA]">캠페인</p>
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
| `designsnitch-check` | UI 코드를 수정한 뒤 | 검사를 실행하고, 후보가 하나뿐인 오류를 고치고, 나머지는 사람에게 보여줍니다. |
| `designsnitch-setup` | 설정 파일이 없을 때 | 토큰 CSS와 공용 컴포넌트 경로를 찾아 `designsnitch.config.json`을 쓰고, 읽어 낸 내용을 확인합니다. |
| `designsnitch-palette` | 프로젝트에 색 토큰이 없을 때 | `designsnitch colors`로 쓰이는 색을 모으고, 토큰을 제안하고, 사람이 승인하면 작성합니다. |
| `designsnitch-eslint` | 프로젝트가 ESLint를 쓸 때 | 같은 규칙을 ESLint flat config에 추가합니다. 프로젝트에 이미 오류가 있으면 먼저 묻습니다. |

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
      "designsnitch/scale-use-token": "error",
      "designsnitch/use-ds-component": "error",
      // 경고: 디자인 시스템에 없는 값이라 사람이 판단해야 함
      "designsnitch/color-unknown": "warn",
      "designsnitch/scale-unknown": "warn",
    },
  },
];
```

같은 규칙 묶음을 `designsnitch.configs.recommended`로도 쓸 수 있습니다. 이미 위반이 많은 프로젝트에 넣으면 오류 등급 규칙 때문에 기존 lint 단계가 실패하므로, 먼저 `designsnitch check`로 개수를 확인하세요. 대체 후보는 ESLint의 제안으로 보고되어 에디터에서 빠른 수정으로 나타납니다.

## 검사 범위

- **검사하는 곳:** 코드 안의 문자열과 템플릿 리터럴입니다. `className`과 `cn()`, `clsx()`, `cva()`의 인자가 여기에 들어갑니다. 주석은 보지 않습니다.
- **간격:** padding, margin, gap, space 유틸리티만 봅니다. `w-[320px]` 같은 크기 유틸리티는 검사하지 않습니다.
- **간격 스케일:** 간격 단위의 0.5배수(`p-0.5`, `p-1.5`, `p-4`)와 `p-px`를 스케일에 있는 값으로 봅니다.
- **단위:** `px`와 `rem`만 봅니다. `1rem`은 16px로 계산합니다.
- **테마:** 토큰이 테마마다 다른 값을 가지면 그 값들을 모두 그 토큰의 값으로 봅니다.
- **수정:** designsnitch는 후보를 알려줄 뿐, 후보가 하나여도 코드를 직접 고치지 않습니다.

### 아직 안 되는 것

- hex가 아닌 색(`rgb()`, `hsl()`, `oklch()`)
- Tailwind 기본 테마의 값. 프로젝트의 토큰 CSS에 적힌 값만 읽습니다.
- Tailwind v3(`tailwind.config.js`)
- 토큰이 없는 색에 가장 가까운 토큰 제시
- 인라인 스타일, `.css` 파일, CSS Modules
- 직접 만든 컴포넌트와 디자인 시스템 컴포넌트의 스타일 비교
- 스킬을 설치해 주는 명령

Figma 같은 시안 파일과 화면을 비교하는 일은 범위 밖입니다. 기준은 디자인 시스템 하나입니다.

## 동작 구조

스킬과 실제 일을 하는 도구를 나누는 방식은 Chrome 팀의 Modern Web Guidance를 따랐습니다. 판정은 CLI가 하고, 스킬은 에이전트가 언제 CLI를 부르고 결과를 어떻게 다룰지만 정합니다. 사람과 AI가 같은 규칙과 같은 결과를 씁니다.

| 층 | 위치 | 하는 일 |
| --- | --- | --- |
| 코어 | `src/core` | 토큰 CSS를 읽어 "값 → 토큰" 표를 만들고, 문자열에서 임의 값 클래스를 찾고, 값을 스케일과 비교합니다. ESLint에 의존하지 않습니다. |
| 규칙 | `src/rules` | AST에서 문자열과 JSX 태그를 찾아 코어에 묻고, 위반과 후보를 보고합니다. ESLint 규칙 형식으로 작성했습니다. |
| 검사 엔진 | `src/check.js` | 규칙을 프로젝트에 실행하고 결과를 위반 목록으로 정리합니다. 코드를 파싱하고 순회하는 데 내부적으로 ESLint를 씁니다. |
| CLI | `src/cli.js` | 인자와 설정 파일을 읽어 엔진을 부르고 결과를 출력합니다. |
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
