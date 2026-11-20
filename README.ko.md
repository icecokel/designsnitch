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

> **상태:** MVP(0.2.x). 메시지는 기본이 영어이고 한국어로 바꿀 수 있습니다. 이 문서의 출력 예시는 한국어로 설정했을 때의 모습입니다. [언어](#언어)를 보세요.

## 시작하기

```sh
npm install --save-dev designsnitch
npx designsnitch install
```

두 번째 명령은 에이전트 스킬을 설치하고 에이전트 훅을 등록합니다. Node.js 22 이상이 필요합니다.

| 에이전트 | 명령 | 스킬 위치 | 훅 위치 |
| --- | --- | --- | --- |
| Claude Code | `npx designsnitch install` | `.claude/skills` | `.claude/settings.json` |
| Codex | `npx designsnitch install --agent codex` | `.agents/skills` | `.codex/hooks.json` |
| Gemini CLI | `npx designsnitch install --agent gemini` | `.agents/skills` | `.gemini/settings.json` |
| Grok Build | `npx designsnitch install --agent grok` | `.grok/skills` | `.grok/hooks/designsnitch.json` |
| 모두 | `npx designsnitch install --agent all` | | |

Codex, Gemini CLI, Grok Build는 새 프로젝트 훅을 승인하거나 프로젝트를 신뢰한 뒤에만 실행합니다. 프로젝트에서 에이전트를 열고, 요청이 나오면 승인하세요. Grok Build에서는 `/hooks-trust`를 쓰거나 `--trust`로 시작합니다.

| 에이전트 | 훅을 확인한 방법 |
| --- | --- |
| Claude Code | 실제 에이전트로 돌려 봤습니다. hex 색을 썼다가 훅의 안내를 받고 토큰 클래스로 바꿨습니다. |
| Codex | 실제 에이전트로 돌려 봤습니다. 결과가 같았습니다. |
| Gemini CLI | **테스트하지 못했습니다.** 공식 Gemini CLI 문서를 기준으로 만들었습니다. |
| Grok Build | **테스트하지 못했습니다.** 공식 xAI 문서를 기준으로 만들었습니다. [에이전트 훅](#에이전트-훅)의 안내를 보세요. |

스킬은 공개 표준인 Agent Skills 형식이라, 이 형식을 지원하는 에이전트라면 어디서든 쓸 수 있습니다. 표준 설치 도구가 에이전트마다 맞는 위치에 넣어 줍니다: `npx skills add icecokel/designsnitch`. 이 도구는 스킬만 설치하고 훅은 설치하지 않습니다.

그다음 코딩 에이전트에게 이렇게 요청합니다.

> 이 프로젝트에 designsnitch를 설정해 줘.

에이전트가 `designsnitch-setup` 스킬을 따라 나머지를 합니다.

1. 지원하는 프로젝트인지 확인합니다.
2. 토큰 CSS와 공용 컴포넌트 폴더를 찾아 `designsnitch.config.json`을 씁니다.
3. 프로젝트에 색 토큰이 없으면, 코드가 쓰는 색을 모아 토큰을 제안합니다. 승인하기 전에는 아무것도 쓰지 않습니다.
4. 규칙을 ESLint에 넣습니다. 프로젝트에 ESLint가 없으면 설치합니다.
5. 무엇을 골랐는지와 첫 검사 결과를 보여줍니다.

그 뒤로는 이렇게 됩니다.

- 에이전트는 파일을 고칠 때마다 오류를 전달받고, 스스로 고칠 수 있는 오류가 남아 있으면 작업을 끝내지 못합니다.
- 오류가 있으면 lint 단계가 실패하고, 에디터에도 표시됩니다.
- `npx designsnitch check`로 코드의 현재 상태를 언제든 볼 수 있습니다.

에이전트 없이 하려면 [직접 설정하기](#직접-설정하기)를 보세요.

## 왜 필요한가

기준이 없으면 화면마다 따로 고르게 됩니다. AI 에이전트는 그 선택을 빠르고 그럴듯하게 하고, 그것이 쌓입니다.

- 같은 파란색이 어떤 화면에서는 `#3B82F6`이고 다른 화면에서는 `#3B82F5`입니다.
- 색 하나가 백 군데에 직접 적혀 있어서, 브랜드 색을 바꾸거나 다크 모드를 넣으려면 전부 찾아야 합니다.
- 화면마다 `<button>`으로 버튼을 새로 만들어서 조금씩 다르고, 어떤 것은 focus 스타일이 없습니다.

그 결과 코드는 관리하기 어려워지고, 서비스는 일관되게 유지하기 어려워집니다. 그리고 기준이 없으면 새 코드를 무엇에 비춰 검사할지도 없습니다. designsnitch는 코드가 이미 하고 있는 것에서 기준을 세우게 돕고, 새 코드가 그 기준을 따르게 합니다.

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

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `designsnitch install` | 스킬을 복사하고 에이전트 훅을 프로젝트에 등록합니다. `--agent claude`(기본), `codex`, `gemini`, `grok`, `all`을 받습니다. |
| `designsnitch colors` | 코드가 쓰는 색을 모아 보여줍니다. 설정 파일이 없어도 됩니다. |
| `designsnitch check` | 코드를 기준에 비춰 검사하고, 위반마다 무엇을 하면 되는지 알려줍니다. |
| `designsnitch hook` | 에이전트의 훅에서 부릅니다. 에이전트가 방금 바꾼 파일을 검사합니다. |

`check`와 `colors`는 경로, `--format json`, `--config <파일>`을 받습니다. 모든 명령은 `--lang en|ko`를 받습니다.

## 직접 설정하기

```sh
npm install --save-dev designsnitch
```

프로젝트 루트에 `designsnitch.config.json`을 만듭니다.

```json
{
  "tokens": "./app/globals.css",
  "lang": "ko",
  "components": {
    "path": "./components/ui",
    "replaces": {
      "button": ["SolidButton", "IconButton"],
      "input": { "component": "Input", "when": { "type": ["text", "email", null] } },
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

각 항목은 [설정](#설정)에 설명되어 있습니다. 위반을 막으려면 [ESLint](#eslint)에 규칙을 넣고 [에이전트 훅](#에이전트-훅)을 등록하세요.

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
| `tokens` | 토큰이 정의된 CSS 파일입니다. 필수입니다. 경로를 적거나, `file`과 선택 항목 `exclude`, `prefer`를 담은 객체로 적습니다(아래 참고). |
| `components.path` | 디자인 시스템 컴포넌트가 있는 경로입니다. 이 안에서는 raw 태그를 써도 됩니다. |
| `components.replaces` | raw 태그와 그것을 대체하는 컴포넌트입니다. 한 태그를 대체하는 컴포넌트가 여러 개면 배열로 적습니다. 컴포넌트가 태그의 일부 변형만 맡으면 `{ "component": ..., "when": { ... } }`로 적습니다(아래 참고). |
| `lang` | 메시지의 언어입니다. `en`(기본) 또는 `ko`입니다. |

`components`를 생략하면 컴포넌트 검사를 하지 않습니다. 다른 경로의 설정 파일을 쓰려면 `--config <파일>`을 붙입니다. 설정 파일 안의 경로는 설정 파일이 있는 디렉터리를 기준으로 풉니다.

값이 같은 토큰이 여럿이면, 그 값을 쓴 hex 색은 모두 후보가 여러 개가 되고 하나하나 사람이 정해야 합니다. `tokens`를 객체로 적으면 이 판단을 설정에서 한 번에 내릴 수 있습니다.

```json
"tokens": {
  "file": "app/globals.css",
  "exclude": ["--color-legacy-*"],
  "prefer": ["--color-brand-"]
}
```

- `exclude`는 기준에서 뺄 토큰입니다. 정확한 이름이나 `*`로 끝나는 접두어를 적습니다. 제외한 토큰만 가진 색은 토큰이 없는 색으로 봅니다. 다른 토큰이 제외한 토큰을 `var()`로 참조하는 것은 그대로 풉니다.
- `prefer`는 우선할 토큰 접두어를 순서대로 적습니다. 처음으로 맞는 접두어가 후보를 하나로 줄이면 그 후보만 남고, 바로 바꿀 수 있는 오류가 됩니다. 여러 개가 남으면 모두 두고 사람이 정합니다.

공용 컴포넌트가 태그의 일부 변형만 맡는 경우가 많습니다. `Input` 컴포넌트는 텍스트 입력은 맡아도 `<input type="file">`은 맡지 않을 수 있습니다. `when`에 컴포넌트가 맡는 속성 값을 적습니다. `null`은 그 속성이 없다는 뜻입니다.

```json
"input": { "component": "Input", "when": { "type": ["text", "email", null] } }
```

- `<input type="file">`은 컴포넌트가 맡지 않으므로 보고하지 않습니다.
- `<input type="text">`와 `<input>`은 바로 바꿀 수 있는 오류로 보고합니다.
- `<input type={kind}>`와 `<input {...props}>`는 보고하되 `ask`로 표시합니다. 값을 실행할 때에야 알 수 있거나 spread가 값을 덮어쓸 수 있어서, 바꿔도 안전한지 알 수 없기 때문입니다.

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

## 언어

메시지는 기본이 영어입니다. 한국어로 보려면 `designsnitch.config.json`에 `"lang": "ko"`를 적거나, 환경 변수 `DESIGNSNITCH_LANG=ko`를 설정하거나, `--lang ko`를 붙입니다. 여러 개를 함께 주면 `--lang`, 설정 파일, 환경 변수 순으로 우선합니다.

ESLint 플러그인도 설정의 같은 `lang`을 읽습니다. 규칙 이름, 출력의 구조, JSON 필드 이름은 두 언어에서 같습니다.

## 출력

```
디자인 시스템: 색 토큰 2개, 컴포넌트 2개

src/PayButton.tsx
  5:6  오류  <button> 대신 디자인 시스템 컴포넌트를 사용하세요: Button (./components/ui)  (use-ds-component)
  7:55  오류  bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500  (color-use-token)
  8:26  경고  bg-[#3B82F5]의 색은 토큰에 없습니다.  (color-unknown)

오류 2개, 경고 1개 (파일 3개 검사)
바로 바꿀 수 있는 것 2건, 사람이 정해야 하는 것 1건 (결정 1개)
```

첫 줄은 설정에서 읽어 낸 토큰과 컴포넌트의 개수입니다. 경로를 잘못 적으면 여기서 0개로 드러납니다. 색 토큰을 하나도 읽지 못하면 `주의:`로 시작하는 줄이 이유를 알려줍니다. 마지막 줄은 바로 바꿀 수 있는 위반과 사람이 정해야 하는 위반이 각각 몇 건이고, 사람이 정할 것이 질문 몇 개로 묶이는지 알려줍니다.

`--format json`은 같은 결과를 구조화해서 출력합니다. 아래 예시는 위반을 종류별로 하나씩만 남기고 나머지는 생략했습니다.

```json
{
  "designSystem": { "colorTokens": 4, "components": 1, "replacedTags": 1 },
  "problems": [],
  "next": [
    "action이 replace인 2건은 found를 candidates의 값으로 바꾸세요.",
    "변경하기 전에 decisions의 2건을 사용자에게 물으세요. 사용 횟수와 후보, 확인이 필요한 이유를 함께 알려 주세요.",
    "고친 뒤 같은 명령을 다시 실행하세요."
  ],
  "summary": { "files": 1, "errors": 4, "warnings": 1 },
  "violations": [
    {
      "file": "src/PayButton.tsx",
      "line": 3,
      "column": 24,
      "endLine": 3,
      "endColumn": 36,
      "rule": "color-use-token",
      "severity": "error",
      "message": "bg-[#3B82F6]의 색은 토큰 --color-brand-500의 값입니다. 대신 사용: bg-brand-500",
      "found": "bg-[#3B82F6]",
      "candidates": ["bg-brand-500"],
      "recommended": "bg-brand-500",
      "action": "replace"
    },
    {
      "file": "src/PayButton.tsx",
      "line": 3,
      "column": 37,
      "endLine": 3,
      "endColumn": 51,
      "rule": "color-use-token",
      "severity": "error",
      "message": "text-[#484646]의 색은 토큰 --color-text-primary, --color-neutral-30의 값입니다. 대신 사용: text-text-primary, text-neutral-30",
      "found": "text-[#484646]",
      "candidates": ["text-text-primary", "text-neutral-30"],
      "recommended": "text-text-primary",
      "action": "ask"
    }
  ],
  "decisions": [
    {
      "id": "decision-1",
      "rule": "color-use-token",
      "subject": "#484646",
      "uses": 2,
      "files": 1,
      "locations": [
        { "file": "src/PayButton.tsx", "line": 3, "column": 37 },
        { "file": "src/PayButton.tsx", "line": 4, "column": 24 }
      ],
      "candidates": ["text-text-primary", "text-neutral-30"],
      "recommended": "text-text-primary",
      "reasons": ["multiple-candidates"]
    },
    {
      "id": "decision-2",
      "rule": "color-unknown",
      "subject": "#3b82f5",
      "uses": 1,
      "files": 1,
      "locations": [{ "file": "src/PayButton.tsx", "line": 4, "column": 39 }],
      "candidates": [],
      "recommended": null,
      "reasons": ["no-token"]
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
| `violations[].recommended` | 색을 쓰는 용도에 맞는 후보입니다. `text-` 클래스면 텍스트용 이름의 토큰, 테두리면 테두리용 이름의 토큰입니다. 맞는 후보가 정확히 하나일 때만 채우고, 추천일 뿐이라 `ask`는 그대로 `ask`입니다. `replace`면 그 후보입니다. |
| `violations[].action` | 이 위반을 어떻게 다룰지입니다. `replace`: `found`를 하나뿐인 후보로 바꿔도 화면과 동작이 같습니다. `ask`: 사람이 정해야 합니다. 후보가 여러 개이거나, 토큰이 없는 색이거나, 테마마다 값이 다른 토큰이거나, 컴포넌트의 속성이 동적이거나 spread된 경우입니다. `repair`: 파일을 읽지 못했습니다. |
| `decisions` | `ask`인 위반을 질문 단위로 묶은 것입니다. 색이나 태그와 후보가 같으면 하나로 묶습니다. 각 항목에 얼마나 나오는지(`uses`, `files`), 위치 최대 다섯 곳(`locations`), 후보(`candidates`), 모든 위치에서 추천이 같을 때의 추천(`recommended`), 사람이 정해야 하는 이유(`reasons`: `multiple-candidates`, `no-token`, `themed-token`, `dynamic-props`)가 있습니다. 많이 나오는 순서입니다. |
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

`npx designsnitch install`은 Claude Code용으로 스킬을 `.claude/skills`에 복사하고, `--agent codex`나 `--agent gemini`를 붙이면 Codex와 Gemini CLI가 읽는 `.agents/skills`에, `--agent grok`을 붙이면 Grok Build가 읽는 `.grok/skills`에 복사합니다. 패키지를 올린 뒤에는 다시 실행해서 스킬을 최신으로 맞추세요. 다른 곳에 복사하려면 패키지의 `skills/` 디렉터리에 있는 것을 쓰면 됩니다.

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

설정 안의 경로는 ESLint의 작업 디렉터리를 기준으로 풉니다. 모노레포처럼 `designsnitch.config.json`이 `eslint.config.js` 옆에 있지 않으면 경로의 기준 디렉터리를 더합니다: `settings: { designsnitch: { ...designSystem, root: "apps/web" } }`.

같은 규칙 묶음을 `designsnitch.configs.recommended`로도 쓸 수 있습니다. 이미 위반이 많은 프로젝트에 넣으면 오류 등급 규칙 때문에 기존 lint 단계가 실패하므로, 먼저 `designsnitch check`로 개수를 확인하세요. 대체 후보는 ESLint의 제안으로 보고되어 에디터에서 빠른 수정으로 나타납니다. CSS 파일은 ESLint가 아니라 CLI에서만 검사합니다.

## 위반을 막는 방법

CLI와 스킬은 AI 에이전트가 제대로 할 수 있는 상태를 만들어 줍니다. 막는 일은 다른 두 곳에서 합니다.

| 어디서 | 언제 잡는가 | 방법 |
| --- | --- | --- |
| ESLint 플러그인 | 에디터와 lint 단계 | 오류가 있으면 lint 단계가 실패합니다. CI에서 lint를 돌리고 통과를 필수로 걸면, 오류가 있는 코드는 병합되지 않습니다. |
| 에이전트 훅 | 에이전트가 코드를 쓰는 동안 | `designsnitch hook`이 파일을 고칠 때마다, 그리고 에이전트가 작업을 끝내기 전에 실행됩니다. |

### 에이전트 훅

스킬은 에이전트가 따르지 않을 수도 있는 안내입니다. 훅은 에이전트의 실행 환경이 매번 실행합니다. Claude Code에는 `npx designsnitch install`이 등록해 줍니다. `.claude/settings.json`에 더해지는 내용은 다음과 같습니다.

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

`designsnitch hook`은 에이전트가 방금 바꾼 파일만 검사하고, 그 변경으로 새로 생긴 오류만 막습니다.

- 파일마다 git `HEAD` 버전과 비교합니다. 같은 규칙, 같은 코드의 오류가 `HEAD`보다 많아졌으면 새 오류입니다. 원래 있던 오류는 줄이 밀려도 막지 않습니다. `HEAD`에 아직 없는 파일은 모든 오류가 새것입니다.
- 파일을 고친 뒤 새 오류가 있으면, 에이전트는 오류와 다음에 할 일을 전달받습니다.
- 에이전트가 작업을 끝내려 할 때 스스로 고칠 수 있는 새 오류가 남아 있으면 끝내지 못합니다. 사람이 정해야 하는 오류는 막지 않습니다. 물어보려면 멈춰야 하기 때문입니다.
- 경고는 막지 않고, 에이전트가 건드리지 않은 파일은 보지 않습니다.
- git 저장소가 아니거나 첫 커밋 전이면, 바꾼 파일의 오류를 모두 셉니다.

Codex에는 `npx designsnitch install --agent codex`가 같은 두 훅을 `.codex/hooks.json`에 씁니다. 파일 수정 쪽은 `apply_patch`에 걸립니다. Codex는 셸 명령으로 파일을 고치는 일이 많은데, 그런 수정은 이 조건에 걸리지 않습니다. 대신 Codex가 작업을 끝내려 할 때 잡힙니다. 그때 훅이 git에서 바뀐 파일을 모두 검사하기 때문입니다.

Gemini CLI에는 `npx designsnitch install --agent gemini`가 훅을 `.gemini/settings.json`에 씁니다. 이벤트 이름이 다릅니다. 파일 수정 직후는 `write_file`과 `replace`에 걸리는 `AfterTool`이고, 답하기 직전은 `AfterAgent`입니다. `AfterAgent`에서 종료 코드 2를 받으면 Gemini CLI는 오류를 피드백 삼아 다시 시도합니다. 공식 Gemini CLI 문서를 기준으로 만들었고, Gemini CLI에서 테스트하지 못했습니다.

Grok Build에는 `npx designsnitch install --agent grok`이 `PostToolUse`와 `Stop` 훅을 `.grok/hooks/designsnitch.json`에 씁니다. 공식 xAI 문서를 기준으로 만들었고 Grok Build에서 테스트하지 못했습니다. 불확실한 점이 하나 있습니다. 문서는 `PreToolUse`만 막는 이벤트라고 하고, 도구 실행 뒤나 작업을 끝낼 때 종료 코드 2가 무엇을 하는지는 적지 않았습니다. 그래서 Grok Build에서는 오류를 알리기만 하고 에이전트를 멈추지 못할 수 있습니다. 또 Grok Build는 Claude Code의 `.claude/settings.json`도 읽기 때문에, `--agent all`로 설치하면 Grok Build에서 훅이 두 번 돌 수 있습니다. 해는 없습니다.

이 명령은 표준 입력으로 JSON을 받을 수 있습니다(`tool_input.file_path`, `hook_event_name`, `stop_hook_active`, 또는 Grok Build가 보내는 camelCase 형식의 같은 필드). 막을 때는 종료 코드 2로 끝나며 stderr에 내용을 쓰고, 파일이 주어지지 않으면 git에서 바뀐 파일을 검사합니다. 같은 방식의 명령 훅을 지원하는 다른 에이전트에서도 쓸 수 있습니다. `designsnitch-hooks` 스킬이 이 설정을 해 줍니다.

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
- **CSS에서 보는 곳:** `.css` 파일(CSS Modules 포함)의 선언 값에 있는 hex 색입니다. 토큰 CSS에서는 변수를 정의하는 선언(`--이름: ...`)을 토큰을 정의하는 곳으로 보고 건너뜁니다. 다른 CSS 파일에서는 변수 선언도 일반 선언처럼 검사합니다. CSS에서는 아직 색만 검사합니다.
- **테마:** 토큰이 테마마다 다른 값을 가지면 그 값들을 모두 그 토큰의 값으로 봅니다. hex 색을 그런 토큰으로 바꾸면 다른 테마에서 색이 바뀌므로 `ask`로 표시합니다.
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
- Claude Code, Codex, Gemini CLI, Grok Build가 아닌 에이전트에 훅 설치하기

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
