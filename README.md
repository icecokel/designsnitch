# designsnitch

AI가 만든 UI 코드에서 디자인이 틀린 곳을 찾아내는 도구입니다. 기준은 프로젝트의 디자인 시스템입니다. 토큰과 컴포넌트 규칙을 벗어난 곳을 찾고, 무엇으로 고치면 되는지 알려줍니다.

세 부분으로 되어 있습니다.

| 부분 | 하는 일 |
| --- | --- |
| 검사 엔진 | 코드를 AST로 분석해 위반 위치와 대체 후보를 찾습니다. |
| CLI | `designsnitch check`로 검사를 실행합니다. 사람이 읽는 출력과 JSON 출력을 냅니다. |
| 에이전트 스킬 | AI 에이전트에게 언제 검사하고, 무엇을 고치고, 무엇을 사람에게 물을지 알려줍니다. |

첫 지원 대상은 **React/Next.js + Tailwind CSS** 프로젝트입니다.

> **상태:** MVP(0.1.x). [지금 되는 것](#지금-되는-것) 아래의 나머지 내용은 목표 설계이며, 정해지지 않은 부분은 [미정 사항](#미정-사항)에 모아 두었습니다.

## 지금 되는 것

Tailwind 클래스에 값을 직접 쓴 곳(`bg-[#3B82F6]`, `p-[16px]`)과 raw 태그를 찾아서 디자인 시스템과 비교합니다.

| 규칙 | 등급 | 잡는 것 |
| --- | --- | --- |
| `color-use-token` | 오류 | 토큰이 있는 색을 hex로 씀 |
| `color-unknown` | 경고 | 토큰이 없는 hex |
| `scale-use-token` | 오류 | 스케일에 있는 간격, 폰트 크기, radius를 임의 값으로 씀 |
| `scale-unknown` | 경고 | 스케일에 없는 간격, 폰트 크기, radius |
| `use-ds-component` | 오류 | 디자인 시스템 컴포넌트가 있는 raw 태그를 디자인 시스템 경로 밖에서 씀 |

### 설치

```sh
npm install --save-dev designsnitch
```

Node.js 22 이상이 필요합니다.

### 설정

프로젝트 루트에 `designsnitch.config.json`을 만듭니다. [에이전트 스킬](#에이전트-스킬)을 쓰면 에이전트가 저장소를 읽어서 이 파일을 만듭니다.

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

| 항목 | 설명 |
| --- | --- |
| `tokens` | 토큰이 정의된 CSS 파일입니다. 필수입니다. |
| `components.path` | 디자인 시스템 컴포넌트가 있는 경로입니다. 이 안에서는 raw 태그를 써도 됩니다. |
| `components.replaces` | raw 태그와 그것을 대체하는 컴포넌트입니다. 컴포넌트가 여러 개면 배열로 적습니다. |

`components`를 생략하면 컴포넌트 검사를 하지 않습니다.

토큰 CSS에서 읽는 변수는 다음과 같습니다.

| 변수 | 쓰임 | 없을 때 |
| --- | --- | --- |
| `--color-*` | 색. 값이 hex이거나, `var()`로 hex 값을 가진 변수를 가리켜야 합니다. | 모든 hex가 경고가 됩니다 |
| `--spacing` | 간격 단위 | Tailwind 기본값 `0.25rem`을 씁니다 |
| `--radius-*` | radius | radius를 검사하지 않습니다 |
| `--text-*` | 폰트 크기 | 폰트 크기를 검사하지 않습니다 |

```css
@theme {
  --color-primary-500: #3B82F6;
  --color-surface: #ffffff;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
}
```

### 실행

```sh
npx designsnitch check                      # 프로젝트 전체
npx designsnitch check src/PayButton.tsx    # 일부만
npx designsnitch check --format json        # CI나 AI 에이전트용
```

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

첫 줄은 설정에서 읽어 낸 토큰과 컴포넌트의 개수입니다. 경로를 잘못 적으면 여기서 0개로 드러납니다. 색 토큰을 하나도 읽지 못하면 `주의:`로 시작하는 줄이 함께 나옵니다.

`--format json`은 같은 결과를 구조화해서 냅니다.

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
| 2 | 실행하지 못함 (설정 파일, 토큰 CSS, 컴포넌트 경로가 없음, 잘못된 인자) |

검사는 프로젝트의 ESLint 설정과 무관하게 돌아갑니다. `.js`, `.jsx`, `.ts`, `.tsx` 파일을 보고, `node_modules`, `.next`, `dist`, `build`, `out`, `coverage`는 건너뜁니다.

### 예외

의도적으로 허용하는 곳에는 주석을 답니다.

```tsx
{/* eslint-disable-next-line designsnitch/color-unknown -- 캠페인 전용 색 */}
<p className="text-[#FF00AA]">캠페인</p>
```

### 에이전트 스킬

`skills/designsnitch/SKILL.md`가 스킬입니다. 에이전트의 스킬 디렉터리에 복사해서 씁니다. Claude Code라면 다음과 같습니다.

```sh
mkdir -p .claude/skills
cp -r node_modules/designsnitch/skills/designsnitch .claude/skills/
```

스킬은 에이전트에게 다음을 지시합니다.

1. 설정 파일이 없으면 저장소에서 토큰 CSS와 공용 컴포넌트 경로를 찾아 `designsnitch.config.json`을 만들고, 검사를 실행해 읽어 낸 개수를 확인한 뒤 사람에게 보여줍니다.
2. UI 코드를 수정한 뒤 `designsnitch check --format json`을 실행합니다.
3. 오류이고 후보가 하나뿐인 위반만 고칩니다.
4. 후보가 여러 개이거나 경고인 것은 고치지 않고, 후보와 맥락을 사람에게 보여줍니다.
5. 다시 검사합니다.

설정 파일은 판정 기준이므로, 에이전트는 없을 때 새로 만들 수만 있고 이미 있는 설정은 사람에게 묻지 않고 고치지 않습니다.

### ESLint 플러그인으로 쓰기

같은 규칙을 프로젝트의 ESLint에 넣어 에디터에서 볼 수도 있습니다. 설정은 `settings.designsnitch`에 같은 내용을 적습니다.

```js
// eslint.config.js
import designsnitch from "designsnitch";

export default [
  designsnitch.configs.recommended,
  {
    settings: {
      designsnitch: { tokens: "./app/globals.css" },
    },
  },
];
```

### 검사 범위

- **검사하는 곳:** 코드 안의 문자열과 템플릿 리터럴입니다. `className`뿐 아니라 `cn()`, `clsx()`, `cva()`의 인자도 잡힙니다. 주석은 보지 않습니다.
- **간격:** padding, margin, gap, space 유틸리티만 봅니다. `w-[320px]` 같은 크기 유틸리티는 보지 않습니다.
- **간격 스케일:** 간격 단위의 0.5배수(`p-0.5`, `p-1.5`, `p-4`)와 `p-px`를 스케일로 봅니다.
- **단위:** `px`와 `rem`만 봅니다. `1rem`은 16px로 계산합니다.

### 아직 안 되는 것

- hex가 아닌 색(`rgb()`, `hsl()`, `oklch()`)
- Tailwind 기본 테마의 값. 프로젝트의 토큰 CSS에 적힌 값만 읽습니다.
- 색의 가장 가까운 토큰 제시
- 어느 테마의 값인지 알려주기. 토큰이 테마마다 다른 값을 가지면 그 값들을 모두 토큰의 값으로 보지만, 어느 테마인지는 구분하지 않습니다.
- 인라인 스타일
- 직접 만든 컴포넌트와 디자인 시스템 컴포넌트의 스타일 비교
- 스킬을 설치해 주는 명령

### 개발

```sh
npm install
npm test
```

### 릴리스

main에 병합하는 것만으로는 배포되지 않습니다. 버전 태그를 푸시하면 GitHub Actions가 테스트를 돌린 뒤 npm에 배포합니다.

```sh
npm version patch        # package.json 버전을 올리고, 커밋과 v0.1.1 태그를 만듭니다
git push --follow-tags   # 커밋과 태그를 푸시하면 배포가 시작됩니다
```

태그와 `package.json`의 버전이 다르거나, 태그가 붙은 커밋이 main에 없으면 배포하지 않습니다.

## 왜 필요한가

AI 에이전트가 만든 UI는 얼핏 보면 그럴듯하지만, 자세히 보면 조금씩 틀려 있는 경우가 많습니다.

- primary 색을 토큰 대신 `bg-[#3B82F6]`으로 박아 둬서, 다크 모드로 바꾸면 그 부분만 색이 그대로 남습니다.
- 버튼 색이 primary와 거의 같지만 미묘하게 다릅니다.
- 간격이 `p-4`여야 할 곳에 `p-[15px]`나 `p-[18px]`가 들어가 있습니다.
- 디자인 시스템에 Button이 있는데 `<button>`으로 새로 만들어서, 높이가 조금 낮거나 focus 스타일이 없습니다.

이런 차이는 리뷰에서 눈으로 잡기 어렵습니다. designsnitch는 코드를 분석해서 이런 곳을 찾아냅니다.

## 판단 기준

| 등급 | 의미 |
| --- | --- |
| **오류** | 디자인 시스템에 쓸 토큰이나 컴포넌트가 있는데 쓰지 않았습니다. 지금 화면이 같아 보여도, 디자인 시스템이 바뀌면 이 코드만 따라가지 않습니다. |
| **경고** | 디자인 시스템에 맞는 토큰이 없습니다. 새 값이 정말 필요한 건지 실수인지 사람이 판단해야 합니다. |

## 감지 대상 한눈에 보기

| 대상 | 오류 | 경고 |
| --- | --- | --- |
| 색 | 토큰이 있는 색을 hex로 씀 | 토큰이 없는 hex |
| 간격, 폰트 크기, radius | 토큰 값과 같은 숫자를 직접 씀 | 스케일에 없는 값 |
| 컴포넌트 | 디자인 시스템 컴포넌트가 있는데 raw 태그나 직접 만든 컴포넌트를 씀 | 없음 |

## 검사하는 곳

Tailwind 프로젝트에서 값을 직접 쓰는 곳은 주로 두 군데입니다.

- **임의 값 클래스:** `bg-[#3B82F6]`, `p-[15px]`, `rounded-[6px]`, `text-[13px]`처럼 대괄호 안에 값을 직접 쓴 클래스입니다. `className` 문자열과 `cn()`, `clsx()`, `cva()` 같은 함수의 인자를 봅니다.
- **인라인 스타일:** `style={{ color: "#3B82F6", padding: 16 }}`

이 문서에서는 편의상 hex라고 부르지만, `rgb()`, `hsl()`, `oklch()`로 쓴 색도 같은 색으로 변환해서 비교합니다.

## 감지 대상

### 1. 색

#### 토큰이 있는 색을 hex로 씀 (오류)

색 값이 토큰 값과 같으면, 그 토큰의 클래스를 쓰라고 알려줍니다.

```
src/features/checkout/PayButton.tsx:12:18  오류
  bg-[#3B82F6] 의 색은 토큰 --color-primary-500 의 값입니다.
  → bg-primary-500 을 사용하세요.
```

토큰이 테마마다 다른 값을 가지면, 어느 테마의 값과 같든 같은 방식으로 잡습니다.

```
src/features/checkout/Card.tsx:8:14  오류
  bg-[#FFFFFF] 의 색은 라이트 테마의 --color-surface 값입니다.
  다크 테마에서는 --color-surface 가 #111827 이므로 이 부분만 흰색으로 남습니다.
  → bg-surface 를 사용하세요.
```

#### 토큰이 없는 hex (경고)

팔레트에 없는 색입니다. 팔레트 색과 아주 가까우면 근사값이나 오타일 가능성이 크므로, 가장 가까운 토큰을 함께 제시합니다.

```
src/features/checkout/PayButton.tsx:20:18  경고
  bg-[#3B82F5] 의 색은 팔레트에 없습니다.
  가장 가까운 토큰: --color-primary-500 (#3B82F6) → bg-primary-500
```

### 2. 간격, 폰트 크기, radius

#### 토큰 값과 같은 숫자를 직접 씀 (오류)

```
src/features/checkout/Summary.tsx:30:5  오류
  p-[16px] 는 간격 스케일에 있는 값입니다.
  → p-4 를 사용하세요.
```

#### 스케일에 없는 값 (경고)

```
src/features/checkout/Summary.tsx:42:5  경고
  p-[15px] 는 간격 스케일에 없습니다.
  가장 가까운 값: p-4 (16px)
```

### 3. 컴포넌트

#### 디자인 시스템 컴포넌트를 쓰지 않음 (오류)

디자인 시스템 경로 밖에서 다음을 찾습니다.

- 디자인 시스템 컴포넌트가 대체하는 raw 태그(`button`, `input`, `select`, `dialog` 등)
- 기존 디자인 시스템 컴포넌트와 역할이 같은, 직접 만든 컴포넌트

직접 만든 컴포넌트는 디자인 시스템 컴포넌트와 스타일을 비교해서, 다른 점이 있으면 함께 보여줍니다. 바꿨을 때 화면이 어떻게 달라지는지 미리 알 수 있습니다.

- 크기, padding, radius, 색이 다른지
- hover, focus, disabled 같은 상태 스타일이 빠졌는지

```
src/features/checkout/ConfirmModal.tsx:5:10  오류
  raw <dialog> 를 디자인 시스템 밖에서 사용했습니다.
  → @/components/ui/Dialog 를 사용하세요.
```

```
src/features/checkout/ConfirmButton.tsx:4:10  오류
  디자인 시스템 Button 과 역할이 같은 컴포넌트입니다.
  - height 36px (Button: 40px)
  - :focus-visible 스타일 없음
  → @/components/ui/Button 을 사용하세요.
```

> 이 절의 출력은 목표 동작을 설명하는 예시입니다. 실제 출력은 [실행](#실행)을 보세요.

## 설계

### 구조

스킬과 실행 도구를 나누는 방식은 Chrome 팀의 Modern Web Guidance를 참고했습니다. 판정은 CLI가 하고, 스킬은 에이전트가 언제 CLI를 부르고 결과를 어떻게 다룰지만 정합니다. 사람과 AI가 같은 규칙과 같은 결과를 씁니다.

| 층 | 위치 | 하는 일 |
| --- | --- | --- |
| 코어 | `src/core` | 토큰 CSS를 읽어 "값 → 토큰" 표를 만들고, 문자열에서 임의 값 클래스를 찾고, 스케일과 비교합니다. ESLint에 의존하지 않습니다. |
| 규칙 | `src/rules` | AST에서 문자열과 JSX 태그를 찾아 코어에 묻고, 위반과 대체 후보를 보고합니다. ESLint 규칙 형식입니다. |
| 검사 엔진 | `src/check.js` | 규칙을 프로젝트에 실행하고 결과를 위반 목록으로 정리합니다. 내부에서 ESLint를 AST 실행기로 씁니다. |
| CLI | `src/cli.js` | 인자와 설정 파일을 읽어 엔진을 부르고, 결과를 출력합니다. |
| 스킬 | `skills/designsnitch` | 에이전트용 지시문입니다. |

오류와 경고는 별도 규칙으로 나눕니다. 대체 후보는 ESLint의 제안(suggestion)으로 보고하므로, 에디터에서는 빠른 수정으로 보이고 CLI의 JSON에는 `candidates`로 나옵니다. 후보가 하나여도 자동 수정은 하지 않습니다.

### 남은 것

1. hex가 아닌 색 읽기
2. Tailwind 기본 테마 값 읽기
3. 인라인 스타일 검사
4. 직접 만든 컴포넌트와 디자인 시스템 컴포넌트 비교. 오탐 기준이 잡히기 전에는 오류로 처리하지 않고 경고나 후보로만 보여줍니다.
5. 스킬 설치 명령

## 범위 밖

- **화면별 시안과의 비교:** Figma 같은 시안 파일을 읽어서 "이 화면이 시안대로인가"를 보는 일은 하지 않습니다. 기준은 디자인 시스템 하나입니다.
- **CSS 파일:** `.css`와 CSS Modules 안의 값은 첫 버전에서 검사하지 않습니다.

## 미정 사항

| 항목 | 내용 |
| --- | --- |
| Tailwind 버전 | CSS의 `@theme`으로 토큰을 정의하는 v4를 먼저 지원한다고 가정했습니다. `tailwind.config.js`를 쓰는 v3도 지원할지 정해야 합니다. |
| Tailwind 기본 팔레트 | 디자인 시스템에 `bg-primary`가 있는데 `bg-blue-500`을 쓴 경우를 잡을지 정해야 합니다. 임의 값은 아니지만 디자인 시스템을 벗어난 색일 수 있습니다. |
| 간격 스케일의 정의 | 지금은 간격 단위의 0.5배수를 모두 스케일로 봅니다. 프로젝트가 쓰는 단계만 허용하도록 좁힐지 정해야 합니다. |
| 근사값 판정 | 토큰이 없는 색이나 값을 볼 때, 얼마나 가까워야 가장 가까운 토큰을 제시할지 정해야 합니다. |
| 역할 판정 | 직접 만든 컴포넌트가 어떤 디자인 시스템 컴포넌트와 역할이 같은지 판단하는 방법을 정해야 합니다. |

## 라이선스

[MIT](./LICENSE)
