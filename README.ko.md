# designsnitch

[English](./README.md) | 한국어

**모든 개발자가 좋은 디자인 시스템이 있는 환경에서 일하지는 않습니다.**

디자인 시스템이 아예 없는 프로젝트가 있고, 있어도 이름뿐인 프로젝트가 있습니다. 디자이너가 없는 팀, 마감에 쫓겨 화면부터 만든 서비스, 토큰 파일(`--color-primary: #3B82F6`처럼 색에 이름을 붙여 모아 둔 파일)은 있는데 아무도 따르지 않는 코드가 그렇습니다. 잘 갖춰진 디자인 시스템을 전제로 한 도구는 이런 프로젝트에서 쓸 수 없습니다.

AI 에이전트가 코드를 쓰면 이 문제는 더 빨리 커집니다. 에이전트는 그럴듯한 화면을 금방 만들지만, 기준이 없으면 화면마다 따로 고릅니다.

- 같은 파란색이 어떤 화면에서는 `#3B82F6`이고 다른 화면에서는 `#3B82F5`입니다.
- 색 하나가 백 군데에 직접 적혀 있어서, 브랜드 색을 바꾸거나 다크 모드를 넣으려면 전부 찾아야 합니다.
- 공용 버튼이 있는데도 화면마다 `<button>`으로 버튼을 새로 만들어서 조금씩 다릅니다.

그 결과 코드는 관리하기 어려워지고, 서비스는 일관되게 유지하기 어려워집니다. 기준이 없으니 새 코드를 무엇에 비춰 검사할지도 없습니다.

**designsnitch의 목표는 이런 프로젝트에서도 AI가 쓴 UI 코드를 관리할 수 있고 일관되게 유지하는 것입니다.** 디자이너나 Figma 파일 없이, 코드 안에서 세 가지를 합니다.

1. **기준을 세웁니다.** 코드가 이미 쓰고 있는 색, 글자 크기, radius를 모아서 토큰으로 정리할 수 있게 합니다. 없는 기준을 새로 만들지 않고, 지금 쓰는 것에서 출발합니다.
2. **기준을 지킵니다.** 새 코드가 그 기준을 따르는지 확인하고, 무엇으로 바꾸면 되는지 알려줍니다. 에이전트가 코드를 쓰는 동안 막습니다.
3. **정리합니다.** 이미 흩어진 코드를 기준에 맞게 되돌리는 일을 돕습니다.

무엇을 기준으로 삼을지는 개발자가 정합니다. 도구는 대신 정하지 않습니다. 어디에 몇 번 쓰였는지, 바꾸면 화면이 달라지는지 같은 판단에 필요한 것을 가져와서 묻습니다.

## 예를 들면

프로젝트에 색 토큰 `--color-primary: #3b82f6`이 있다고 합시다. 에이전트가 버튼을 만들면서 색을 직접 씁니다.

```tsx
<a className="rounded bg-[#3B82F6] px-4 py-2 text-white">Start</a>
```

에이전트가 파일을 고치자마자 designsnitch 훅(에이전트가 파일을 고칠 때마다 자동으로 실행되는 검사)이 에이전트에게 이렇게 돌려줍니다.

```text
designsnitch: 방금 고친 파일에 디자인 시스템 오류가 1건 있습니다.

src/app/Hero.tsx:2:32  bg-[#3B82F6]의 색은 토큰 --color-primary의 값입니다. 대신 사용: bg-primary  [replace]
```

이 오류가 남아 있으면 에이전트는 작업을 끝내지 못하므로, 토큰 클래스로 바꿉니다. 같은 색이라 화면은 그대로입니다.

```tsx
<a className="rounded bg-primary px-4 py-2 text-white">Start</a>
```

## 구성

| 부분 | 목적 |
| --- | --- |
| CLI | AI 에이전트가 쓰는 도구입니다. 쓰이는 색을 모으고, 코드를 검사하고, 위반마다 무엇을 하면 되는지 알려줍니다. |
| 에이전트 스킬 | 에이전트가 읽고 따르는 작업 안내서(Markdown 파일)입니다. 프로젝트를 어떻게 설정하고, 언제 CLI를 실행하고, 무엇을 고치고, 무엇을 사람에게 물을지 알려줍니다. |
| ESLint 플러그인 | 막고 경고합니다. 같은 규칙이 에디터와 lint 단계에서 오류와 경고로 나옵니다. |
| 에이전트 훅 | 코드를 쓰는 동안 막습니다. 에이전트는 파일을 고칠 때마다 새로 생긴 오류를 전달받고, 바로 바꿀 수 있는 오류가 남아 있으면 작업을 끝내지 못합니다. |

**Tailwind CSS v4나 v3를 쓰는 React/Next.js 프로젝트**를 지원합니다. v3에서는 인라인 스타일에 직접 쓴 색에 후보가 없습니다. v3가 색에 CSS 변수를 만들지 않기 때문입니다([Tailwind v3](#tailwind-v3) 참고).

> **상태:** MVP(0.8.x). 색, 공용 컴포넌트, radius, 글자 크기를 검사합니다. 간격은 검사하지 않습니다([검사 범위](#검사-범위) 참고). 메시지는 기본이 영어이고 한국어로 바꿀 수 있습니다. 이 문서의 출력 예시는 한국어로 설정했을 때의 모습입니다. [언어](#언어)를 보세요.

## 시작하기

```sh
npm install --save-dev designsnitch
npx designsnitch install
```

두 번째 명령은 에이전트 스킬을 설치하고 에이전트 훅을 등록합니다. Node.js 20.19 이상이 필요합니다.

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

- 에이전트는 파일을 고칠 때마다 새로 생긴 오류를 전달받고, 바로 바꿀 수 있는 오류가 남아 있으면 작업을 끝내지 못합니다. 세션 전부터 있던 오류는 세지 않습니다.
- 오류가 있으면 lint 단계가 실패하고, 에디터에도 표시됩니다.
- `npx designsnitch check`로 코드의 현재 상태를 언제든 볼 수 있습니다.

에이전트 없이 하려면 [직접 설정하기](#직접-설정하기)를 보세요.

## 내 컴퓨터에만 깔아 쓰기

위의 방법은 designsnitch를 프로젝트에 세팅합니다. git으로 공유되므로 팀원 모두에게 적용됩니다. 개인용 에이전트 스킬처럼 내 컴퓨터에만 둘 수도 있습니다. 프로젝트에는 아무것도 설치하지 않고 `designsnitch.config.json` 하나만 생깁니다. 팀에 도입하기 전에 내 작업에서 먼저 써 보기에 좋습니다.

1. **스킬을 사용자 폴더에 설치합니다.** 표준 설치 도구에 전역 옵션이 있습니다.

   ```sh
   npx skills add icecokel/designsnitch -g
   ```

2. **훅을 사용자 설정에 등록합니다.** Claude Code는 `~/.claude/settings.json`입니다. 버전을 고정해 줄 프로젝트 사본이 없으므로 `@latest`로 적습니다.

   ```json
   {
     "hooks": {
       "PostToolUse": [
         { "matcher": "Edit|Write|MultiEdit", "hooks": [{ "type": "command", "command": "npx -y designsnitch@latest hook" }] }
       ],
       "Stop": [{ "hooks": [{ "type": "command", "command": "npx -y designsnitch@latest hook" }] }],
       "SessionStart": [{ "hooks": [{ "type": "command", "command": "npx -y designsnitch@latest hook" }] }]
     }
   }
   ```

   Codex는 같은 내용을 `~/.codex/hooks.json`에 두고, matcher는 `apply_patch`입니다. 훅은 `designsnitch.config.json`이 없는 프로젝트에서는 아무것도 하지 않으므로, 켜 둔 채로 두어도 됩니다.

3. **프로젝트에서 에이전트에게, 아무것도 설치하지 말고 설정하라고 요청합니다.**

   > 이 프로젝트에 designsnitch를 설정해 줘. 프로젝트에는 아무것도 설치하지 말고, ESLint 연결은 건너뛰어.

   이 말이 없으면 setup 스킬이 패키지를 프로젝트에 추가하고 ESLint를 연결합니다. 그것은 팀용 세팅입니다.

포기하는 것: ESLint 플러그인과 CI는 프로젝트에 패키지가 있어야 하므로, 다른 팀원의 코드나 다른 팀원의 에이전트는 막지 못합니다. 명령은 처음 한 번 `npx`가 받아 오고 그 뒤로는 캐시에서 실행합니다(훅 한 번에 약 0.5초).

확인한 방법: `node_modules`가 없는 프로젝트에서 `check`와 `hook`을 실행했고, 빈 홈 폴더에 `-g`로 스킬을 설치해 봤고, 훅을 프로젝트 밖에 등록한 실제 Claude Code와 Codex 세션이 `bg-[#3B82F6]`을 썼다가 훅에 막혀 토큰 클래스로 고쳤습니다. 이 실행들은 실제 사용자 설정을 건드리지 않았습니다. Claude Code에는 훅을 `--settings`로 넘겼고, Codex는 같은 `hooks.json`을 둔 임시 Codex 홈으로 돌렸습니다. Codex는 새 훅을 승인한 뒤에만 실행합니다.

## 무엇을 잡는가

등급은 한 가지 기준을 따릅니다.

| 등급 | 의미 |
| --- | --- |
| **오류** | 디자인 시스템에 쓸 토큰이나 컴포넌트가 있는데 쓰지 않았습니다. 지금 화면이 같아 보여도, 디자인 시스템이 바뀌면 이 코드만 따라가지 않습니다. |
| **경고** | 디자인 시스템에 맞는 토큰이 없습니다. 새 값이 정말 필요한 건지 실수인지 사람이 판단해야 합니다. |

| 규칙 | 등급 | 잡는 것 |
| --- | --- | --- |
| `color-use-token` | 오류 | 토큰이 있는 색을 임의 값(`bg-[#3B82F6]`), 인라인 스타일(`style={{ color: "#3B82F6" }}`), CSS 선언(`color: #3B82F6`), `@apply`에 직접 씀 |
| `color-unknown` | 경고 | 직접 쓴 색인데 맞는 토큰이 없음 |
| `use-ds-component` | 오류 | 공용 컴포넌트가 대체하는 `<button>` 같은 raw 태그를 디자인 시스템 경로 밖에서 씀 |

### radius와 글자 크기

토큰 CSS가 `@theme`에 토큰을 정의한 경우에만 검사합니다. radius는 `--radius-*`, 글자 크기는 `--text-*`입니다. 그런 토큰이 없는 프로젝트에는 radius와 글자 크기를 알리지 않습니다. 비춰 볼 기준이 없기 때문입니다. `designsnitch sizes`가 코드가 직접 쓴 값을 모아 보여주므로, 그중 무엇을 토큰으로 삼을지 정할 수 있습니다.

| 규칙 | 등급 | 잡는 것 |
| --- | --- | --- |
| `radius-use-token` | 오류 | 토큰이 있는 radius를 임의 값 클래스(`rounded-[12px]`), 인라인 스타일(`borderRadius: 12`), CSS 선언에 직접 씀 |
| `radius-unknown` | 경고 | 직접 쓴 radius인데 맞는 토큰이 없음 |
| `font-size-use-token` | 오류 | 토큰이 있는 글자 크기를 `text-[14px]`, 인라인 스타일, CSS 선언에 직접 씀 |
| `font-size-unknown` | 경고 | 직접 쓴 글자 크기인데 맞는 토큰이 없음 |

바꿔도 안전한지는 값을 어떻게 썼는지에 따라 다릅니다.

| 경우 | 처리 |
| --- | --- |
| 같은 단위의 같은 값. 예: `12px`와 `12px` 토큰 | `replace`. `--fix`가 고칩니다. |
| px와 rem을 환산해야 같은 값. 예: `8px`와 `0.5rem` 토큰 | `ask`, 이유 `unit-conversion`. 읽는 사람의 브라우저 글자 크기가 16px이 아니면 둘이 달라집니다. |
| 글자 크기 클래스. `text-[14px]` → `text-body` | `ask`, 이유 `line-height`. 테마가 줄 높이를 정해 두면 글자 크기 클래스가 줄 높이도 함께 정하므로 글의 위치가 달라질 수 있습니다. |

px와 rem으로 그대로 적은 길이만 읽습니다. `calc()`나 `var()` 안의 값, 퍼센트, `0`, `9999px` 같은 알약 모양 값은 건너뜁니다. 간격(padding, margin, gap)은 `designsnitch sizes`가 모아 보여주기만 하고 검사하지 않습니다. 값 하나만 봐서는 실수인지 의도인지 알 수 없기 때문입니다. Tailwind v3 프로젝트에는 radius와 글자 크기를 검사하지 않습니다.

직접 쓴 색이란 hex, 숫자를 그대로 적은 색 함수(`rgb()`, `hsl()`, `oklch()`), `white` 같은 색 이름입니다. 표기는 상관없습니다. `#3B82F6`, `rgb(59 130 246)`, `hsl(217 91% 60%)`는 검사에서 같은 색입니다.

오류에는 대신 쓸 것이 함께 나옵니다. JS와 TS 파일에서는 클래스나 컴포넌트이고, 인라인 스타일과 CSS 파일에서는 `var(--토큰)`입니다. Tailwind v4는 소스에서 `var()`로 쓴 테마 변수를 출력하므로, 인라인 스타일의 `var(--토큰)`도 같은 색으로 보입니다. Tailwind v3 프로젝트에서는 CSS 파일의 후보가 `theme("colors.토큰")`입니다.

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `designsnitch install` | 스킬을 복사하고 에이전트 훅을 프로젝트에 등록합니다. Claude Code에는 `check`와 `colors` 명령도 허용해 둡니다. `--agent claude`(기본), `codex`, `gemini`, `grok`, `all`을 받습니다. |
| `designsnitch colors` | 코드가 쓰는 색을 모아 보여줍니다. 설정 파일이 없어도 됩니다. |
| `designsnitch sizes` | 코드가 직접 쓴 글자 크기, radius, 간격을 모아 보여줍니다. 설정 파일이 없어도 됩니다. |
| `designsnitch check` | 코드를 기준에 비춰 검사하고, 위반마다 무엇을 하면 되는지 알려줍니다. |
| `designsnitch check --fix` | 바꿔도 화면이 같은 것(`replace`)을 JS, TS, CSS 파일에서 고친 뒤, 남은 것을 알려줍니다. 경로를 주면 그 파일만 고칩니다. |
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
| `문자열 1` | 문자열 전체가 색인 경우입니다. 인라인 스타일이나 차트 옵션이 여기에 들어갑니다. |
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
| `palette` | `"tailwind"`로 두면 Tailwind 기본 팔레트를 기준에 넣습니다([Tailwind 기본 팔레트](#tailwind-기본-팔레트) 참고). |
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
- `<input type="text">`와 `<input>`은 컴포넌트로 옮길 오류(`migrate`)로 보고합니다.
- `<input type={kind}>`와 `<input {...props}>`는 보고하되 `ask`로 표시합니다. 값을 실행할 때에야 알 수 있거나 spread가 값을 덮어쓸 수 있어서, 바꿔도 안전한지 알 수 없기 때문입니다.

토큰 CSS에서 읽는 것은 다음과 같습니다.

| 변수 | 쓰임 | 없을 때 |
| --- | --- | --- |
| `--color-*` | 색. 값이 hex, `rgb()`, `hsl()`, `oklch()` 색이거나, `var()`를 따라가면 그런 값이 나와야 합니다. | 직접 쓴 색이 모두 경고가 됩니다 |

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

변수를 어디에 선언했는지도 봅니다.

- `--color-*` 변수는 `@theme` 안이나 어디서나 적용되는 규칙(`:root`, `html`, `:host`)에 선언돼 있어야 토큰입니다. `.promo { --color-promo: ... }`처럼 다른 선택자 안에만 선언된 변수는 토큰이 아닙니다. 그 선택자 밖에는 없는 변수이기 때문입니다.
- 토큰을 선택자나 미디어 쿼리 안(`.dark`, `@media (prefers-color-scheme: dark)`)에서 다시 선언하면 테마마다 값이 다른 토큰이고, 색을 그 토큰으로 바꾸는 것은 `ask`로 표시합니다.
- `var(--raw, #fff)`는 `--raw`가 없는 곳에서 fallback을 씁니다. `--raw`가 일부 선택자 안에만 있으면 fallback과 그 값을 모두 토큰의 값으로 보므로, 이것도 `ask`가 됩니다.

토큰은 Tailwind가 읽는 곳에서도 읽습니다.

- **`@theme` 밖의 토큰.** Tailwind v4는 `@theme`에 선언한 변수로만 유틸리티 클래스를 만듭니다. `:root { --color-brand: #3B82F6; }`처럼 다른 곳에 선언한 토큰은 CSS 변수일 뿐이고 `bg-brand` 클래스는 없습니다. 클래스가 필요한 자리에서는 변수를 직접 가리키는 `bg-(--color-brand)`를 후보로 내고, 이유 `no-class`와 함께 `ask`로 표시합니다. 토큰을 `@theme`으로 옮기는 쪽을 고를 수도 있기 때문입니다. 스타일과 CSS 선언에서는 어디에 선언했든 `var(--color-brand)`가 통합니다. `--radius-*`와 `--text-*`도 같습니다. Tailwind 4에서 확인했습니다. `:root` 변수에 대해 `bg-brand`는 CSS가 만들어지지 않았고 `bg-(--color-brand)`는 만들어졌습니다.
- **import한 CSS.** 토큰 CSS가 다른 CSS 파일을 불러오면(`@import "../brand/theme.css"`나 패키지) 그 파일의 `@theme` 토큰도 읽습니다.
- **접두어.** `@import "tailwindcss" prefix(tw)`를 쓰면 Tailwind가 CSS 변수 이름을 `--tw-color-*`로 만들므로, `var()` 후보도 그렇게 적습니다. 클래스 후보는 `tw:` 뒤의 부분만 바꿉니다.
- **JavaScript 설정.** `@config "./tailwind.config.js"`가 있으면 `theme.extend.colors`(프리셋 포함)의 색이 토큰이 되고, `theme.colors`는 기본 팔레트를 대체합니다. Tailwind v4의 동작과 같습니다. 이 색들은 클래스로만 있습니다. Tailwind가 CSS 변수를 만들지 않기 때문입니다. 인라인 스타일이나 CSS 선언에 직접 쓰면 오류로 알리되 후보는 없고, 어떻게 할지는 사람이 정합니다. 설정을 읽으려면 그 파일을 실행하므로, 그 파일이 require하는 것이 설치돼 있어야 합니다. 불러오지 못하면 결과의 `problems`에 알립니다.

### Tailwind v3

v3 프로젝트는 색을 `tailwind.config.js`에 두고, CSS는 `@tailwind base`로 시작합니다. `tokens`는 평소처럼 CSS 파일을 가리키면 됩니다. 그 CSS가 `@tailwind`를 쓰면 `designsnitch.config.json` 옆의 `tailwind.config.js`(또는 `.cjs`, `.mjs`, `.ts`)를 읽습니다. `tokens`에 설정 파일을 직접 적어도 됩니다. `"palette": "tailwind"`는 v3 팔레트를 `tailwindcss/colors`에서 읽습니다.

v3는 색에 CSS 변수를 만들지 않으므로 가리킬 `var()`가 없습니다. 대신 색이 어디에 쓰였는지에 따라 후보가 달라집니다.

| 색이 쓰인 곳 | 후보 |
| --- | --- |
| 임의 값 색 클래스 `bg-[#3B82F6]` | 토큰 클래스 `bg-brand-500` |
| CSS 선언 `color: #3B82F6` | `theme("colors.brand.500")` |
| 인라인 스타일 | 없음. `theme()`은 CSS 밖에서 동작하지 않으므로 사람이 정합니다. |

Tailwind v3는 CSS 파일을 처리할 때 `theme("colors.brand.500")`을 토큰의 값으로 바꾸므로, 빌드된 CSS는 달라지지 않습니다. Tailwind 3.4.17 앱에서 확인했습니다. 바꾸기 전과 후에 빌드한 CSS가 바이트 단위로 같았습니다. Tailwind가 처리하는 CSS에서만 동작하며, Next.js 프로젝트에서는 PostCSS를 거치는 모든 CSS 파일이 해당합니다.

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
바로 바꿀 수 있는 것 1건, 컴포넌트로 옮길 것 1건, 사람이 정해야 하는 것 1건 (결정 1개)
```

첫 줄은 설정에서 읽어 낸 토큰과 컴포넌트의 개수입니다. 경로를 잘못 적으면 여기서 0개로 드러납니다. 색 토큰을 하나도 읽지 못하면 `주의:`로 시작하는 줄이 이유를 알려줍니다. 마지막 줄은 바로 바꿀 수 있는 위반, 컴포넌트로 옮길 태그, 사람이 정해야 하는 위반이 각각 몇 건이고, 사람이 정할 것이 질문 몇 개로 묶이는지 알려줍니다.

`--format json`은 같은 결과를 구조화해서 출력합니다. 아래 예시는 위반을 종류별로 하나씩만 남기고 나머지는 생략했습니다.

```json
{
  "designSystem": { "colorTokens": 4, "components": 1, "replacedTags": 1 },
  "problems": [],
  "next": [
    "action이 replace인 1건은 npx designsnitch check --fix 로 고치세요. found를 후보로 바꿉니다. 경로를 주면 그 파일만 고칩니다.",
    "action이 migrate인 1건은 태그를 candidates의 컴포넌트로 바꾸세요. 먼저 그 컴포넌트를 읽고, import를 더하고, 컴포넌트가 받는 props를 넘기고, 컴포넌트가 이미 주는 className은 지우세요. 태그가 하던 일을 컴포넌트가 못 하거나 모양이 달라지면, 컴포넌트를 고쳐서 맞추지 말고 태그를 그대로 둔 채 사용자에게 물으세요.",
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
| `fixed` | `--fix`를 줬을 때만 있습니다. 고친 곳의 수입니다. 결과의 나머지는 고친 뒤의 코드를 설명합니다. |
| `violations[].recommended` | 색을 쓰는 용도에 맞는 후보입니다. `text-` 클래스면 텍스트용 이름의 토큰, 테두리면 테두리용 이름의 토큰입니다. 맞는 후보가 정확히 하나일 때만 채우고, 추천일 뿐이라 `ask`는 그대로 `ask`입니다. `replace`와 `migrate`면 그 후보입니다. |
| `violations[].action` | 이 위반을 어떻게 다룰지입니다. `replace`: `found`를 하나뿐인 후보로 바꿔도 화면과 동작이 같습니다. 색 오류만 해당합니다. `migrate`: raw 태그를 옮길 디자인 시스템 컴포넌트가 하나뿐입니다. 컴포넌트가 같은 props를 넘기는지, 기본 스타일이 같은지는 도구가 알 수 없으므로 컴포넌트를 먼저 읽고 태그의 props를 옮기고 컴포넌트가 이미 주는 클래스는 지웁니다. 훅은 고친 직후에 알리기만 하고, 이것 때문에 에이전트가 끝내는 것을 막지는 않습니다. `ask`: 사람이 정해야 합니다. 후보가 여러 개이거나, 토큰이 없는 색이거나, 테마마다 값이 다른 토큰이거나, 컴포넌트의 속성이 동적이거나 spread된 경우입니다. `repair`: 파일을 읽지 못했습니다. |
| `decisions` | `ask`인 위반을 질문 단위로 묶은 것입니다. 색이나 태그와 후보가 같으면 하나로 묶습니다. 각 항목에 얼마나 나오는지(`uses`, `files`), 위치 최대 다섯 곳(`locations`), 후보(`candidates`), 모든 위치에서 추천이 같을 때의 추천(`recommended`), 사람이 정해야 하는 이유(`reasons`: `multiple-candidates`, `no-token`, `themed-token`, `translucent`, `not-a-style`, `class-only-token`, `dynamic-props`, `unit-conversion`, `line-height`, `no-class`)가 있습니다. 많이 나오는 순서입니다. |
| `next` | 이 결과를 받은 에이전트가 할 일을 순서대로 적은 것 |
| `unchecked` | 검사하지 못한 다른 문자열 속 색의 개수(`colors`)와 파일 수(`files`). 하나라도 있으면 글 출력에 한 줄이 붙습니다. |

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
      "designsnitch/radius-use-token": "error",
      "designsnitch/font-size-use-token": "error",
      // 경고: 디자인 시스템에 없는 값이라 사람이 판단해야 함
      "designsnitch/color-unknown": "warn",
      "designsnitch/radius-unknown": "warn",
      "designsnitch/font-size-unknown": "warn",
    },
  },
];
```

설정 안의 경로는 ESLint의 작업 디렉터리를 기준으로 풉니다. 모노레포처럼 `designsnitch.config.json`이 `eslint.config.js` 옆에 있지 않으면 경로의 기준 디렉터리를 더합니다: `settings: { designsnitch: { ...designSystem, root: "apps/web" } }`.

같은 규칙 묶음을 `designsnitch.configs.recommended`로도 쓸 수 있습니다. 이미 위반이 많은 프로젝트에 넣으면 오류 등급 규칙 때문에 기존 lint 단계가 실패하므로, 먼저 `designsnitch check`로 개수를 확인하세요. `eslint --fix`는 바꿔도 화면이 같은 것만 고칩니다. 맞는 토큰이 하나뿐인 색을 클래스나 스타일에 직접 쓴 경우입니다. `designsnitch check`가 `replace`로 표시하는 위반과 같고, 둘은 같은 판정을 씁니다. 나머지(후보가 여러 개, 반투명한 색, 테마마다 값이 다른 토큰, 스타일이 아닌 자리의 색)는 사람이 골라야 하므로 ESLint 제안으로 남고, 에디터에서 빠른 수정으로 나타납니다. CSS 파일은 ESLint가 아니라 CLI에서만 검사합니다.

### oxlint

같은 플러그인이 [oxlint](https://oxc.rs)에서 JS 플러그인으로 돌아갑니다. `.oxlintrc.json`에 넣습니다.

```json
{
  "jsPlugins": ["designsnitch"],
  "rules": {
    "designsnitch/color-use-token": "error",
    "designsnitch/use-ds-component": "error",
    "designsnitch/color-unknown": "warn",
    "designsnitch/radius-use-token": "error",
    "designsnitch/radius-unknown": "warn",
    "designsnitch/font-size-use-token": "error",
    "designsnitch/font-size-unknown": "warn"
  }
}
```

`settings`는 일부러 적지 않았습니다. `.oxlintrc.json`은 다른 파일을 불러올 수 없으므로, `settings.designsnitch`가 없으면 플러그인이 작업 디렉터리의 `designsnitch.config.json`을 읽습니다. 기준은 한 곳에만 있습니다. ESLint에서도 `settings`를 빼면 똑같이 동작합니다. 모노레포처럼 설정 파일이 다른 곳에 있으면 `settings.designsnitch`를 `root`와 함께 직접 적습니다.

oxlint 1.95.0에서 확인했습니다. 같은 프로젝트에서 oxlint와 `designsnitch check`가 같은 곳을 같은 규칙으로 잡았고, 패키지의 테스트가 둘을 대조합니다. oxlint는 JS 플러그인을 알파 단계라고 하므로, oxlint 버전에 따라 달라질 수 있습니다.

`oxlint --fix`는 `eslint --fix`와 똑같이 안전합니다. 이 규칙에는 `oxlint --fix-suggestions`를 쓰지 마세요. 후보가 여러 개라 사람이 골라야 하는 곳까지 첫 번째 제안으로 바꿉니다.

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
    ],
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "npx designsnitch hook" }]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(npx designsnitch check *)",
      "Bash(npx designsnitch colors *)",
      "Bash(npx designsnitch sizes *)"
    ]
  }
}
```

`permissions`는 스킬이 쓰는 명령 `check`, `colors`, `sizes`를 Claude Code가 매번 묻지 않고 실행하게 합니다. `colors`와 `sizes`는 파일을 읽기만 합니다. `check`는 `--fix`를 줄 때만 파일을 바꾸고, 그때도 바꿔도 화면이 같은 곳만 바꿉니다. 이미 있는 규칙은 그대로 두고, `Bash(npx designsnitch *)`처럼 더 넓은 규칙이 있으면 아무것도 더하지 않습니다.

Claude Code는 프로젝트의 `.claude/settings.json`에 있는 허용 규칙을, 그 프로젝트의 신뢰 확인을 수락한 뒤에만 씁니다. 신뢰 확인은 터미널에서 프로젝트를 처음 열 때 나옵니다. 그렇게 열어 본 적이 없는 프로젝트에서는, 예를 들어 새로 받은 저장소에서 `claude -p`로 실행하면, 이 규칙을 버리고 다시 승인을 요청합니다. 그럴 때는 `--allowedTools "Bash(npx designsnitch check *)"`를 넘기세요. Claude Code 2.1.329에서 확인했습니다. 규칙이 있을 때 신뢰한 폴더에서는 묻지 않고 실행했고, 신뢰하지 않은 폴더에서는 거부됐습니다.

`designsnitch hook`은 에이전트가 방금 바꾼 파일만 검사하고, 그 변경으로 새로 생긴 오류만 막습니다.

- 파일마다 git `HEAD` 버전과 비교합니다. 같은 규칙, 같은 코드의 오류가 `HEAD`보다 많아졌으면 새 오류입니다. 원래 있던 오류는 줄이 밀려도 막지 않습니다. `HEAD`에 아직 없는 파일은 모든 오류가 새것입니다.
- 파일을 고친 뒤 새 오류가 있으면, 에이전트는 오류와 다음에 할 일을 전달받습니다.
- 에이전트가 작업을 끝내려 할 때, 바꿔도 화면과 동작이 같은 새 오류(`replace`와 읽지 못한 파일)가 남아 있으면 끝내지 못합니다. 사람이 정해야 하는 오류(`ask`)는 막지 않습니다. 물어보려면 멈춰야 하기 때문입니다. 컴포넌트로 옮길 태그(`migrate`)도 막지 않습니다. 컴포넌트가 똑같이 동작하는지 도구가 알 수 없으므로, 고친 직후에 알리기만 하고 판단은 에이전트와 사용자에게 맡깁니다.
- 세션이 시작되기 전부터 작업 폴더에 있던 오류는 커밋하지 않았더라도 새 오류로 치지 않습니다. 훅이 세션이 시작될 때(`SessionStart`) 적어 둡니다. 그 이벤트가 없으면 세션의 첫 수정 때, 방금 고친 파일을 뺀 나머지 바뀐 파일을 적어 둡니다. 에이전트가 세션 id를 보내 줘야 합니다.
- 경고는 막지 않고, 에이전트가 건드리지 않은 파일은 보지 않습니다.
- git 저장소가 아니거나 첫 커밋 전이면, 바꾼 파일의 오류를 모두 셉니다.

Codex에는 `npx designsnitch install --agent codex`가 같은 훅들을 `.codex/hooks.json`에 씁니다. 파일 수정 쪽은 `apply_patch`에 걸립니다. Codex는 셸 명령으로 파일을 고치는 일이 많은데, 그런 수정은 이 조건에 걸리지 않습니다. 대신 Codex가 작업을 끝내려 할 때 잡힙니다. 그때 훅이 git에서 바뀐 파일을 모두 검사하기 때문입니다.

Gemini CLI에는 `npx designsnitch install --agent gemini`가 훅을 `.gemini/settings.json`에 씁니다. 이벤트 이름이 다릅니다. 파일 수정 직후는 `write_file`과 `replace`에 걸리는 `AfterTool`이고, 답하기 직전은 `AfterAgent`입니다. `AfterAgent`에서 종료 코드 2를 받으면 Gemini CLI는 오류를 피드백 삼아 다시 시도합니다. 공식 Gemini CLI 문서를 기준으로 만들었고, Gemini CLI에서 테스트하지 못했습니다.

Grok Build에는 `npx designsnitch install --agent grok`이 `PostToolUse`와 `Stop` 훅을 `.grok/hooks/designsnitch.json`에 씁니다. 공식 xAI 문서를 기준으로 만들었고 Grok Build에서 테스트하지 못했습니다. 불확실한 점이 하나 있습니다. 문서는 `PreToolUse`만 막는 이벤트라고 하고, 도구 실행 뒤나 작업을 끝낼 때 종료 코드 2가 무엇을 하는지는 적지 않았습니다. 그래서 Grok Build에서는 오류를 알리기만 하고 에이전트를 멈추지 못할 수 있습니다. 또 Grok Build는 Claude Code의 `.claude/settings.json`도 읽기 때문에, `--agent all`로 설치하면 Grok Build에서 훅이 두 번 돌 수 있습니다. 해는 없습니다.

이 명령은 표준 입력으로 JSON을 받을 수 있습니다(`tool_input.file_path`, `hook_event_name`, `stop_hook_active`, 또는 Grok Build가 보내는 camelCase 형식의 같은 필드). 막을 때는 종료 코드 2로 끝나며 stderr에 내용을 쓰고, 파일이 주어지지 않으면 git에서 바뀐 파일을 검사합니다. 같은 방식의 명령 훅을 지원하는 다른 에이전트에서도 쓸 수 있습니다. `designsnitch-hooks` 스킬이 이 설정을 해 줍니다.

### Tailwind 기본 팔레트

Tailwind 기본 팔레트(`bg-slate-100`, `text-indigo-600`)를 기준으로 쓰는 프로젝트가 많습니다. `"palette": "tailwind"`를 두면 기본 팔레트를 기준에 넣습니다.

```json
{ "tokens": "app/globals.css", "palette": "tailwind" }
```

- 팔레트는 프로젝트에 설치된 `tailwindcss/theme.css`에서 읽습니다. 토큰 CSS 위치에서 찾으므로 언제나 설치된 버전과 맞습니다. Tailwind CSS v4(4.0 이상)가 필요합니다. v3이거나 tailwindcss를 찾지 못하면 검사를 멈추고 어느 쪽인지 알립니다. 4.0.0, 4.1.0, 4.2.0, 4.3.0, 4.3.5로 확인했습니다. 버전 사이에 값이 바뀐 색은 없고, 4.2.0에서 `mauve`, `olive`, `mist`, `taupe` 계열이 추가됐습니다.
- 팔레트 색과 값이 같은 hex는 오류이고, 팔레트 클래스가 후보입니다: `bg-[#62748e]` → `bg-slate-500`. Tailwind v4는 팔레트를 `oklch()`로 적어서, 비교할 때 hex로 바꿉니다. sRGB 밖의 팔레트 색은 같은 색을 내는 hex가 없으므로 같은 `oklch()` 값과만 맞춥니다.
- 프로젝트 토큰 CSS에 팔레트와 같은 이름의 토큰이 있으면 프로젝트 값을 씁니다. Tailwind 문서의 기본색 덮어쓰기 예시처럼 hex로 적어도, `oklch()`로 적어도 됩니다.
- Tailwind 문서에 나온 대로 프로젝트가 비운 네임스페이스는 뺍니다. `--color-*: initial`은 팔레트 전체를, `--color-lime-*: initial`은 그 계열을, `--*: initial`은 기본 테마 전체를 지웁니다.
- `tokens`의 `exclude`와 `prefer`는 팔레트 색에도 적용됩니다.
- 팔레트도 토큰으로 세므로, 자기 토큰이 없는 프로젝트도 "토큰 없음"으로 보지 않습니다.

`palette`가 없으면 기본 팔레트 클래스를 위반으로 잡지 않고, hex와 비교하지도 않습니다. 프로젝트가 자기 토큰만 써야 한다면, Tailwind v4에서 기본 팔레트를 없앨 수 있습니다. 그러면 그런 클래스가 아예 동작하지 않습니다.

```css
@theme {
  --color-*: initial;
  --color-primary-500: #3B82F6;
}
```

## 검사 범위

- **JS와 TS에서 보는 곳:** 문자열과 템플릿 리터럴 안의 임의 값 색 클래스(`className`과 `cn()`, `clsx()`, `cva()`의 인자 포함)와, 색을 받는 자리에 문자열로 적은 색입니다. `a ? "#fff" : "#000"`이나 `x || "#fff"`처럼 고르는 식의 값도 봅니다. 주석은 보지 않습니다.
  - **스타일:** JSX `style` 객체와 `CSSProperties` 타입의 객체입니다. 여기서는 `var(--토큰)`이 통하므로 다른 색과 똑같이 검사합니다. `cardStyle` 같은 변수 이름은 근거로 삼지 않습니다. 차트 설정 묶음일 수 있기 때문입니다.
  - **그 밖의 색 속성:** 이름이 CSS 색 속성이거나 `Color`로 끝나는 속성과 JSX 속성입니다. 차트 옵션의 `backgroundColor`, SVG 요소의 `stroke` 같은 것입니다. 색은 알리고 `var(--토큰)`을 후보로 주지만 `ask`로 표시합니다. 캔버스처럼 `var()`가 통하지 않는 곳에 쓰일 수 있기 때문입니다.
  - **나머지:** 다른 이름의 키(`{ primary: "#3B82F6" }`)와 배열 안의 색은 코드만 보고 용도를 알 수 없어 검사하지 않습니다. 대신 있다는 것을 알 수 있도록 `unchecked`에 개수를 세고, `designsnitch colors`로 목록을 볼 수 있습니다.
- **CSS에서 보는 곳:** `.css` 파일(CSS Modules 포함)의 선언 값에 있는 색과 `@apply`의 임의 값 색 클래스입니다. 토큰 CSS에서는 변수를 정의하는 선언(`--이름: ...`)을 토큰을 정의하는 곳으로 보고 건너뜁니다. 다른 CSS 파일에서는 변수 선언도 일반 선언처럼 검사합니다. CSS에서는 아직 색만 검사합니다.
- **테마:** 토큰이 테마마다 다른 값을 가지면 그 값들을 모두 그 토큰의 값으로 봅니다. 색을 그런 토큰으로 바꾸면 다른 테마에서 색이 바뀌므로 `ask`로 표시합니다.
- **수정:** designsnitch는 후보를 알려줄 뿐, 후보가 하나여도 코드를 직접 고치지 않습니다.

### 아직 안 되는 것

감지는 하지만 토큰과 맞추지는 못하는 것:

- 반투명한 색(`#3B82F680`, `rgb(0 0 0 / 50%)`)은 불투명한 색의 토큰에 불투명도를 붙인 후보를 받습니다. 클래스는 `bg-brand/50`, 스타일과 CSS 선언은 `color-mix(in srgb, var(--color-brand) 50%, transparent)`입니다. 불투명도를 정수 퍼센트로 반올림하므로 `ask`로 표시합니다. `rgba(0, 0, 0, 0)`처럼 완전히 투명한 값은 색을 쓴 것이 아니므로 건너뜁니다.
- Tailwind 플러그인이 더하는 색은 토큰으로 알지 못합니다. 그 색을 직접 쓰면 토큰 없는 색으로 알립니다.
- `hwb()`, `lab()`, `lch()`, `oklab()`, `color()` 값과 sRGB 밖의 `oklch()` 색은 같은 값으로 적은 토큰과만 맞춥니다. 같은 색을 내는 hex가 없기 때문입니다.
- 색 이름은 색 속성(`color`, `background`, `border` 등), 임의 값 클래스(`bg-[white]`), 값 전체가 색 이름인 변수 선언에서만 읽습니다. 다른 곳의 `red` 같은 단어는 색으로 보지 않습니다.

검사하지 않는 것:

- 색 팔레트를 뺀 Tailwind 기본 테마의 값
- 토큰이 없는 색에 가장 가까운 토큰 제시
- `replace`가 아닌 것의 자동 수정. 태그를 컴포넌트로 옮기는 것(`migrate`)과 사람이 정해야 하는 것(`ask`)은 `--fix`가 건드리지 않습니다.
- Biome. ESLint 플러그인을 돌릴 수 없고, 자체 플러그인 API는 다른 문법 트리를 쓰므로 규칙을 새로 써야 합니다.
- 색을 뜻하지 않는 이름의 키에 적은 색(`{ primary: "#3B82F6" }`)과 배열 안의 색. `unchecked`에 개수로만 셉니다.
- SCSS 같은 전처리기
- 간격. `designsnitch sizes`가 모아 보여주기만 합니다. 값 하나만 봐서는 실수인지 의도인지 알 수 없습니다.
- Tailwind v3 프로젝트의 radius와 글자 크기, 그리고 Tailwind 기본 radius·글자 크기 단계. 프로젝트가 직접 정한 `--radius-*`, `--text-*` 토큰만 기준입니다.
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
