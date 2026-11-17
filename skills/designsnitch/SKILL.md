---
name: designsnitch
description: React/Next.js + Tailwind 프로젝트에서 UI 코드를 만들거나 고친 뒤, 디자인 시스템(토큰, 공용 컴포넌트)을 벗어난 곳을 검사하고 고친다. 컴포넌트나 페이지, className, 스타일을 수정했을 때, 또는 사용자가 디자인 시스템 준수, 토큰 사용, 디자인 검사를 말할 때 사용한다.
---

# designsnitch

UI 코드를 수정했으면 작업을 끝내기 전에 디자인 시스템 검사를 실행한다. 판정은 CLI가 하고, 이 문서는 언제 실행하고 결과를 어떻게 다룰지를 정한다.

## 1. 검사 실행

수정한 파일을 지정해서 실행한다. 경로를 생략하면 프로젝트 전체를 검사한다.

```sh
npx designsnitch check src/features/checkout/PayButton.tsx --format json
```

종료 코드는 0(오류 없음), 1(오류 있음), 2(실행하지 못함)이다.

2로 끝나면 stderr의 메시지를 읽는다. 설정 파일 `designsnitch.config.json`이 없다는 메시지면, 토큰 CSS 경로와 디자인 시스템 컴포넌트 경로를 추측해서 만들지 말고 사용자에게 묻는다.

## 2. 결과 읽기

```json
{
  "summary": { "files": 1, "errors": 2, "warnings": 1 },
  "violations": [
    {
      "file": "src/features/checkout/PayButton.tsx",
      "line": 7,
      "column": 28,
      "endLine": 7,
      "endColumn": 40,
      "rule": "color-use-token",
      "severity": "error",
      "message": "bg-[#3B82F6]의 색은 토큰 --color-primary-500의 값입니다. 대신 사용: bg-primary-500",
      "found": "bg-[#3B82F6]",
      "candidates": ["bg-primary-500"]
    }
  ]
}
```

- `found`는 위반한 코드 조각이고, `candidates`는 대신 쓸 클래스나 컴포넌트다.
- `severity`가 `error`면 디자인 시스템에 쓸 것이 있는데 쓰지 않은 것이다. `warning`이면 디자인 시스템에 없는 값이다.

## 3. 고치기

대체가 확실한 위반만 고친다.

| 상황 | 할 일 |
| --- | --- |
| `error`이고 `candidates`가 하나 | `found`를 그 후보로 바꾼다. |
| `error`이고 `candidates`가 둘 이상 | 바꾸지 않는다. 후보들과 그 코드가 쓰인 맥락(무엇의 배경인지, 무엇의 글자색인지)을 사용자에게 보여주고 고르게 한다. |
| `warning` | 바꾸지 않는다. 새 값이 정말 필요한지 실수인지는 사용자가 정한다. 가까운 후보가 있으면 함께 보여준다. |
| `rule`이 `parse-error` | 문법 오류부터 고친 뒤 다시 검사한다. |

`rule`이 `use-ds-component`일 때는 태그 이름만 바꾸면 안 된다. 디자인 시스템 컴포넌트 파일을 읽어 props를 확인하고, import를 추가하고, 컴포넌트가 이미 가진 스타일과 겹치는 className을 정리한다.

## 4. 다시 검사

고친 뒤 같은 명령을 다시 실행한다. 남은 것이 사용자의 결정을 기다리는 항목뿐일 때 멈춘다.

## 5. 보고

고친 것과 남긴 것을 나눠서 알린다. 남긴 것은 파일과 줄, 후보, 남긴 이유를 함께 적는다.

## 하지 않는 것

- 검사를 통과시키려고 `eslint-disable` 주석을 넣거나 `designsnitch.config.json`을 고치지 않는다. 예외가 필요해 보이면 사용자에게 묻는다.
- 후보가 여러 개일 때 임의로 하나를 고르지 않는다.
